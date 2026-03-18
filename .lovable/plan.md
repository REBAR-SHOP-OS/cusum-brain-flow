

## Vizzy Full Audit — All Problems Found

### CRITICAL BUGS

**1. Stale Closure: ERP context never reaches OpenAI (voice sessions start without data)**

In `useVizzyVoiceEngine.ts`, `startSession` calls `setErpContext(data.briefing)` then waits 150ms and calls `originalStartSession()`. But `originalStartSession` is captured from `engine.startSession`, which closes over the `fullInstructions` computed *before* `setErpContext` triggers a re-render. The 150ms delay isn't enough — React hasn't re-rendered yet, so the `useVoiceEngine` config still has the old instructions (without ERP data). The voice session connects to OpenAI with only the base prompt, zero business data.

**Fix:** Use a ref to hold the latest instructions, and pass the instructions directly to `startSession` rather than relying on React state propagation. Or restructure to await the state update by moving the fetch *before* constructing the engine, or by passing instructions as a parameter to `voice-engine-token` at call time (which it already supports).

**2. `voice-engine-token` has NO authentication**

The edge function (`supabase/functions/voice-engine-token/index.ts`) does not validate the JWT or check auth at all. Anyone with the anon key can mint unlimited OpenAI Realtime ephemeral tokens. This is a direct cost vulnerability — each token creates an OpenAI billing session. Config confirms `verify_jwt = false` and the function code has zero auth checks.

**Fix:** Add JWT verification in-code: extract the Bearer token, validate with `supabase.auth.getUser()`, and optionally check admin role.

**3. `vizzy-daily-brief` sends full system prompt to OpenAI through `voice-engine-token`**

The entire `VIZZY_INSTRUCTIONS` + ERP briefing (potentially 50KB+) is sent as `instructions` in the body to `voice-engine-token`, which forwards it to OpenAI's session creation. This means the full ERP data (customer names, financials, AR/AP) is transmitted client→edge→OpenAI in a single POST body. If the context is very large, it may exceed OpenAI's session instruction limits.

---

### MODERATE ISSUES

**4. `vizzy-daily-brief` rate limit comment is wrong**

Line comment says "Rate limit: 5 per 10 minutes" but the actual RPC call uses `_max_requests: 10, _window_seconds: 300` (10 per 5 minutes). Misleading for maintenance.

**5. `VizzyDailyBriefing` fetches via `supabase.functions.invoke` but `useVizzyVoiceEngine` uses `invokeEdgeFunction`**

Two different invocation methods for the same edge function. `invokeEdgeFunction` has retry/timeout logic; `supabase.functions.invoke` does not. If the briefing takes >10s (Gemini processing a full ERP snapshot), the daily briefing widget may silently fail without retry.

**6. `VizzyPhotoButton` is not used in `VizzyVoiceChat`**

The photo analysis button component exists but is not rendered inside the voice chat UI. The import exists in `VizzyPhotoButton.tsx` but is never imported by `VizzyVoiceChat.tsx`. Users cannot send photos during voice sessions.

**7. `vizzyAutoReport` uses `as any` type casts for `vizzy_fix_requests`**

The table is referenced via `as any` in both `vizzyAutoReport.ts` and `FixRequestQueue.tsx`, suggesting it may not be in the generated types. This means no type safety on inserts/selects and silent failures if schema changes.

**8. `FixRequestQueue` dedup `.then(() => {})` fire-and-forget**

Line 110: duplicate resolution is fire-and-forget with no error handling. If the update fails, duplicates persist and accumulate silently.

---

### MINOR / UX ISSUES

**9. Floating button visible on all pages including `/vizzy` full-screen route**

The `FloatingVizzyButton` doesn't check `location.pathname === "/vizzy"` to hide itself. When the user navigates to `/vizzy` (full-screen voice chat), the floating button remains visible underneath.

**10. Voice chat `orbitAngle` animation runs `requestAnimationFrame` infinitely**

In `VizzyVoiceChat.tsx`, the orbit animation runs even when the component is backgrounded or the session has ended. While it has cleanup, it updates state on every frame (~60 setState/sec), which is wasteful. Should use CSS animation instead.

**11. No session duration limit**

Voice sessions have no max-duration timeout. An accidentally-open session could run indefinitely, consuming OpenAI Realtime billing continuously.

---

### Plan Summary

| # | Issue | Severity | Files |
|---|-------|----------|-------|
| 1 | Stale closure — ERP data never sent to OpenAI | Critical | `useVizzyVoiceEngine.ts` |
| 2 | No auth on `voice-engine-token` | Critical | `voice-engine-token/index.ts` |
| 3 | Full ERP in instructions body (size risk) | Moderate | `useVizzyVoiceEngine.ts` |
| 4 | Rate limit comment mismatch | Minor | `vizzy-daily-brief/index.ts` |
| 5 | Inconsistent edge function invocation | Moderate | `VizzyDailyBriefing.tsx` |
| 6 | Photo button not wired into voice chat | Minor | `VizzyVoiceChat.tsx` |
| 7 | `as any` on vizzy_fix_requests | Minor | Multiple files |
| 8 | Fire-and-forget dedup update | Minor | `FixRequestQueue.tsx` |
| 9 | Floating button visible on /vizzy | Minor | `FloatingVizzyButton.tsx` |
| 10 | RAF-based orbit animation (perf) | Minor | `VizzyVoiceChat.tsx` |
| 11 | No voice session duration cap | Moderate | `useVoiceEngine.ts` |

### Recommended Fix Priority

**Phase 1 (Critical — do now):**
- Fix #2: Add auth to `voice-engine-token` — validate JWT, check user exists
- Fix #1: Restructure `useVizzyVoiceEngine` to use a ref for instructions so the engine always has the latest context when connecting

**Phase 2 (Moderate — next):**
- Fix #5: Switch `VizzyDailyBriefing` to use `invokeEdgeFunction` for retry/timeout
- Fix #11: Add 30-minute max session timeout to `useVoiceEngine`
- Fix #4: Correct the rate limit comment

**Phase 3 (Polish):**
- Fix #9: Hide floating button on `/vizzy`
- Fix #10: Replace RAF orbit with CSS animation
- Fix #6: Wire `VizzyPhotoButton` into voice chat UI

