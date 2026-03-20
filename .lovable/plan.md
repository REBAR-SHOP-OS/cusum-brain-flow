
# ✅ COMPLETED: Switch rc_make_call from RingOut to WebRTC

## What changed
- `supabase/functions/admin-chat/index.ts` — `rc_make_call` tool now returns a `browser_action: "webrtc_call"` response instead of executing server-side RingOut. The confirm_action path emits a `browser_action` SSE event.
- `supabase/functions/vizzy-erp-action/index.ts` — `rc_make_call` case returns `browser_action` instead of calling `ringcentral-action`.
- `src/hooks/useAdminChat.ts` — Added `BrowserActionHandler` type and `browser_action` SSE event parsing. Invokes callback when received.
- `src/pages/LiveChat.tsx` — Connects `useRingCentralWidget().makeCall()` to the `browser_action` handler so calls are placed via WebRTC widget.

## Why
RingOut (two-leg callback) requires the RC app/device to answer first. The device wasn't picking up, so calls never connected. WebRTC places calls directly from the browser.

## Files updated
- `supabase/functions/admin-chat/index.ts`
- `supabase/functions/vizzy-erp-action/index.ts`
- `src/hooks/useAdminChat.ts`
- `src/pages/LiveChat.tsx`
