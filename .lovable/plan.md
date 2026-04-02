

# Live-Ops Audit: RingCentral Stale Sync + Vizzy No Response

## Current State After Previous Fixes

Both Vizzy fixes from the approved plan are **already applied**:
- `vizzy-pre-digest`: All `user.id` → `userId` — confirmed clean
- `useVoiceEngine.ts`: Audio element appended to DOM with `playsinline` + explicit `play()` — confirmed applied

Two issues remain open.

---

## Issue A: RingCentral — Sync Stale, Badge Misleading

### Root Cause (two bugs)

**Bug 1: Hardcoded "connected" in HTTP response (line 120)**
`ringcentral-oauth/index.ts` computes `resolvedStatus` correctly and writes it to the DB, but the HTTP response on line 120 always returns `{ status: "connected" }`. The frontend card reads this response, not the DB, so the card always shows "Connected" regardless of actual state.

**Bug 2: Staleness only triggers if status is already "error" (line 107)**
`const resolvedStatus = (hasError && syncIsStale) ? "error" : "connected"` — this requires BOTH `hasError` (existing DB status is "error") AND `syncIsStale`. If the stored status is "connected" but sync stopped 8 days ago, it stays "connected" forever. Staleness alone should be sufficient to flag an error.

**Bug 3: No cron job exists for `ringcentral-sync`**
No `pg_cron` schedule found in any migration. The sync function exists and supports cron mode, but nothing triggers it. Data goes stale because sync only runs on manual UI triggers.

### Fix Plan

1. **`ringcentral-oauth/index.ts` line 107**: Change condition to `syncIsStale || hasError` (staleness alone is sufficient)
2. **`ringcentral-oauth/index.ts` line 120**: Return `resolvedStatus` and `resolvedError` instead of hardcoded "connected"
3. **Create cron schedule**: Add `pg_cron` job to call `ringcentral-sync` every 15 minutes via `net.http_post`

### Files
- `supabase/functions/ringcentral-oauth/index.ts` (2 line changes)
- New cron schedule SQL (via insert tool, not migration)

---

## Issue B: Vizzy Live — No Assistant Response

### Already Fixed
- Audio element DOM attachment — applied
- `vizzy-pre-digest` crash — applied

### Remaining Risk: Model String

`useVizzyVoiceEngine.ts` line 434 uses `gpt-4o-mini-realtime-preview`. This model may be deprecated or rate-limited by OpenAI. If the WebRTC session connects but the model refuses to generate responses, the data channel simply never emits `response.audio_transcript.done` events — resulting in exactly the observed behavior (session live, speech captured, no response).

### Fix Plan

1. **Add diagnostic logging** in `useVoiceEngine.ts` data channel handler: log ALL incoming message types (not just handled ones) so we can confirm whether OpenAI is sending any response events at all
2. **Update model** from `gpt-4o-mini-realtime-preview` to `gpt-4o-realtime-preview-2024-12-17` in `useVizzyVoiceEngine.ts` (line 434) and `voice-engine-token/index.ts` (line 13 default) — this is the current stable realtime model

### Files
- `src/hooks/useVizzyVoiceEngine.ts` (model string)
- `supabase/functions/voice-engine-token/index.ts` (default model)
- `src/hooks/useVoiceEngine.ts` (diagnostic logging in data channel handler)

---

## Summary

| Issue | Layer | Root Cause | Fix |
|-------|-------|-----------|-----|
| RC badge always "connected" | Edge function response | Hardcoded status in HTTP response | Return `resolvedStatus` |
| RC never flags stale | Edge function logic | Requires both error AND stale | Change to OR condition |
| RC sync not running | Infrastructure | No cron job | Add pg_cron schedule |
| Vizzy no response | Transport/Model | Possibly deprecated model + no diagnostics | Update model + add logging |

## Priority
1. RingCentral status fix (immediate, clear bugs)
2. RingCentral cron schedule (root cause of staleness)
3. Vizzy model update (likely root cause of silence)
4. Vizzy diagnostic logging (confirms fix or reveals next layer)

