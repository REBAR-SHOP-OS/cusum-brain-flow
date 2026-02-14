
# Vizzy Comprehensive Audit and Improvement Plan

## Audit Findings

### 1. Dead Code and Unused Components
- **VizzyApprovalDialog.tsx** is imported nowhere (line 16 of VizzyPage.tsx says "removed -- voice calls auto-execute"). The file still exists with 70 lines of unused code.
- **Camera button** in VizzyPage.tsx (line 673-678) renders a non-functional camera button -- it has no `onClick` handler that triggers photo analysis. The `VizzyPhotoButton` component exists but is not used on VizzyPage.
- **`vizzy-photo-analyze`** edge function uses raw Gemini API with `GEMINI_API_KEY` instead of Lovable AI gateway (inconsistent with all other Vizzy functions).
- **Duplicate context builders**: `useVizzyContext.ts` (client-side, ~200 lines) and `vizzyFullContext.ts` (server-side, ~356 lines) do almost the same thing but diverge in fields (server has memories, suggestions, stock; client has QB live data, bank accounts, payments). This causes data inconsistency between voice and text chat.

### 2. Bugs and Issues
- **`vizzy-erp-action`** uses deprecated `supabaseUser.auth.getClaims()` which may not exist on all Supabase JS versions -- potential runtime crash.
- **`vizzy-erp-action`** lists tools in the context prompt (update_cut_plan_status, update_lead_status, etc.) but these are NOT registered as `clientTools` in the ElevenLabs conversation -- they only work via the `[VIZZY-ACTION]` tag hack, which is fragile.
- **Memory leak**: `silentIntervalRef` interval (line 297) is only cleared on wake or component unmount, but if the session disconnects during silent mode, the interval persists.
- **`vizzy-erp-action`** calls `update_lead_status` but the leads table uses `status` column while the context prompt says it uses `stage` -- potential mismatch.
- **RTL detection** still exists in LiveChat.tsx (line 24-29) despite the language policy saying Vizzy is English-only. Harmless but contradicts the policy.

### 3. Performance Issues
- **Context is loaded twice on voice page**: `loadFullContext()` fetches 13+ parallel DB queries client-side, then sends the result to `vizzy-briefing` edge function which calls Gemini to compress it. Meanwhile, the daily brief also calls `buildFullVizzyContext` server-side. This is redundant -- the voice page should use the server-side builder directly.
- **Knowledge base limit**: Client fetches up to 1000 knowledge entries and serializes ALL content into the context string. This can produce a 10,000+ word context, causing slow ElevenLabs processing and high token costs.
- **No caching**: Every voice session fetches fresh context from scratch (13+ queries). A 5-minute cache would reduce DB load significantly for rapid reconnects.

### 4. Security Concerns
- **Super admin email hardcoded** in 2 places: VizzyPage.tsx (line 37) and admin-chat/index.ts (line 11). Should use role-based check (`has_role(uid, 'admin')`) instead.
- **vizzy-erp-action** properly checks admin role but uses deprecated auth method.

### 5. UX Issues
- **No transcript visibility on VizzyPage**: The voice page shows avatar and controls but no scrollable transcript -- users can't review what was said.
- **Camera button is decorative**: The camera icon exists but does nothing.
- **No session persistence**: Closing VizzyPage loses all transcript. The `saveTranscript` only fires on intentional stop, not on page close/crash.

---

## Improvement Plan

### Phase 1: Clean Up Dead Code
| File | Action |
|------|--------|
| `src/components/vizzy/VizzyApprovalDialog.tsx` | Delete file entirely |
| `src/pages/VizzyPage.tsx` | Remove the dead camera button (lines 672-678), wire up `VizzyPhotoButton` properly |
| `src/pages/LiveChat.tsx` | Remove `isRTLText` function (lines 24-29) and RTL `dir` logic per English-only policy |

### Phase 2: Fix Bugs
| File | Fix |
|------|-----|
| `src/pages/VizzyPage.tsx` | Clear `silentIntervalRef` in `onDisconnect` handler to prevent memory leak |
| `supabase/functions/vizzy-erp-action/index.ts` | Replace deprecated `getClaims()` with `getUser()` for auth verification |
| `supabase/functions/vizzy-photo-analyze/index.ts` | Switch from raw Gemini API to Lovable AI gateway (`google/gemini-2.5-flash`) for consistency and no separate API key dependency |

### Phase 3: Unify Context Engine
- Remove client-side `useVizzyContext.ts` hook
- Have VizzyPage call a new lightweight edge function that runs `buildFullVizzyContext` server-side and returns the result
- This eliminates the duplicate context builder and ensures voice + text chat see identical data
- Add the missing fields from client context (QB live data, bank accounts) to the server-side builder

### Phase 4: Performance
- Add a 5-minute context cache in VizzyPage using `sessionStorage` -- skip re-fetch on rapid reconnects
- Limit knowledge base entries to 50 most recent in the context string (with a note about total count)
- Truncate email body previews to 50 chars instead of 80

### Phase 5: Security
- Replace hardcoded `SUPER_ADMIN_EMAIL` checks with `has_role(uid, 'admin')` in both VizzyPage.tsx and admin-chat edge function
- This allows any admin to use Vizzy voice and text chat

### Phase 6: UX Improvements
- Add a collapsible transcript panel to VizzyPage (slide-up from bottom) so users can review conversation history during the session
- Wire the camera button to `VizzyPhotoButton` component so photo analysis actually works
- Add `beforeunload` listener to save transcript on accidental page close

---

## Summary of Changes

| Area | Files Modified | Impact |
|------|---------------|--------|
| Dead code cleanup | 3 files (delete 1, edit 2) | Cleaner codebase |
| Bug fixes | 3 files | Prevent crashes and memory leaks |
| Context unification | 3 files (delete 1, edit 2) | Consistent data across voice/text |
| Performance | 2 files | Faster reconnects, lower token costs |
| Security | 2 files | Role-based access instead of email hardcoding |
| UX | 1 file (VizzyPage.tsx) | Transcript visibility, working camera, crash safety |
