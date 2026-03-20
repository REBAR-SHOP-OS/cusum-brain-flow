

## Diagnosis Summary

**SMS works. Call API succeeds (HTTP 200 + ringout_id). But your phone never rings.**

The `ringcentral-action` edge function successfully:
1. Refreshes tokens
2. Fetches caller ID (+14168603608)
3. Sends RingOut request to RingCentral API
4. Gets back a valid `ringout_id`: `s-a0306c92f92bdz19d089843c3z8e715e90000`

The code is working correctly. RingCentral accepted the call request. The problem is that RingOut's **first leg** (ringing YOUR phone/app at +14168603608 before connecting to the destination) is not reaching your device.

---

## Root Cause

RingOut is a **two-leg callback** system:
1. **Leg 1**: RingCentral calls YOUR number (+14168603608) first
2. **Leg 2**: Once you answer, it connects to the destination (+16479848183)

Your RingCentral app/device is not picking up leg 1, so the call never progresses. SMS bypasses this entirely (server-to-server), which is why it works.

---

## Proposed Fix: Add WebRTC Direct Dialing

Instead of relying on RingOut (which requires your RC app/device to answer first), switch to **WebRTC browser-based calling** using the RingCentral Embeddable widget already loaded in your app. This places calls directly from the browser — no external device needed.

### Changes

1. **`supabase/functions/vizzy-erp-action/index.ts`** — For `rc_make_call`, instead of calling `ringcentral-action` (RingOut), return a `browser_action` response that tells the frontend to use the Embeddable widget's `makeCall` function.

2. **`supabase/functions/admin-chat/index.ts`** — Update the `rc_make_call` tool handler to return a `webrtc_call` action type instead of invoking RingOut server-side.

3. **Frontend action handler** (the component that processes confirmed actions) — Detect `webrtc_call` action type and call `useRingCentralWidget().makeCall(phoneNumber)` to place the call directly through the browser widget.

### Why This Works
- The Embeddable widget (`useRingCentralWidget.ts`) already supports `makeCall` via WebRTC
- SIP provision is already working (logs show successful provisioning with 4 caller IDs)
- No dependency on external RC app/device answering
- Call happens directly in the browser

### Fallback
- Keep RingOut as an optional fallback for when the browser widget isn't loaded
- Add call status monitoring after initiation

---

## Technical Details

```text
CURRENT FLOW (broken):
  Vizzy → admin-chat → vizzy-erp-action → ringcentral-action → RC API RingOut
  → RC tries to ring +14168603608 (device) → no answer → call dies

PROPOSED FLOW:
  Vizzy → admin-chat → returns {action: "webrtc_call", phone: "..."} 
  → Frontend detects action → calls widget.makeCall(phone) 
  → WebRTC call placed directly from browser
```

### Files to modify:
- `supabase/functions/admin-chat/index.ts` — Change `rc_make_call` handling to return browser-side action
- `supabase/functions/vizzy-erp-action/index.ts` — Update `rc_make_call` case
- Frontend action execution component (needs identification) — Handle `webrtc_call` action type
- Keep `ringcentral-action` as-is for direct API use cases

