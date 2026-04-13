

# Fix WebRTC Connection + Add Debug Instrumentation

## Confirmed Diagnosis (from logs + code)

### Bug 1 — Session timeout never cleared (causes retry failures)
`useVizzyRealtimeVoice.ts` line 392: `sessionTimeout` is a local `const` inside `startSession`. It is **never stored in a ref** and **never cleared** when:
- `cleanup()` runs
- `startSession()` is called again for retry

Result: The old 20s timer fires `cleanup()` on the **new** attempt's PC, closing it mid-handshake → `InvalidStateError: signalingState is 'closed'`.

### Bug 2 — Primary ICE connectivity failure
Attempt 1 completes SDP exchange successfully (201 from OpenAI) but the PC goes `connecting → failed` after 16 seconds. This means ICE candidate connectivity checks fail — no media path established. This needs instrumentation to confirm whether it's a TURN/relay issue or a firewall block.

## Plan

### File 1: `src/hooks/useVizzyRealtimeVoice.ts`

**Fix the timeout bug:**
- Store `sessionTimeout` in a ref (`sessionTimeoutRef`)
- Clear it in `cleanup()` and at the start of `startSession()`

**Add `debugStep` state** — a string showing the current connection step, exposed to the UI.

**Add debug logs at each stage:**
1. `"token_fetch_started"` — before fetch
2. `"token_fetch_ok"` — after successful response
3. `"mic_requesting"` — before getUserMedia
4. `"mic_granted"` — after getUserMedia succeeds
5. `"pc_created"` — after RTCPeerConnection created
6. `"sdp_offer_created"` — after createOffer
7. `"ice_gathering"` — after setLocalDescription
8. `"sdp_post_started"` — before fetch to OpenAI
9. `"sdp_post_ok"` — after 201 response
10. `"remote_desc_applied"` — after setRemoteDescription
11. `"waiting_session_created"` — waiting for data channel event
12. `"data_channel_open"` — dc open event
13. `"session_created"` — session.created received

Also log `iceConnectionState` changes alongside `connectionState`.

**Update error detail** to include the last debug step: `"Failed at step: {debugStep}"`.

### File 2: `src/components/vizzy/VizzyVoiceChat.tsx`

**Add debug status line** — show `debugStep` below the status text when connecting or error state, using a small monospace font. No UI redesign.

Read `debugStep` from the voice engine return value.

### File 3: `src/hooks/useVizzyVoiceEngine.ts`

Pass through `debugStep` from the realtime voice hook.

## No backend changes. No ERP routing changes. Reversible — remove debugStep state and logs later.

