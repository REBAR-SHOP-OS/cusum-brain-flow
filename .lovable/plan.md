
Goal

- Fix the real failure path in `/vizzy-live`: the SDP retry logic is falsely treating a successful retry as a hard failure.

What I found

- The latest logs change the diagnosis:
  - the bounded SDP POST does sometimes get a 500 upstream
  - the full-gather retry then succeeds with HTTP 201
  - but the client still throws `OpenAI SDP exchange failed (201): Internal Server Error`
- That points to a control-flow bug in `src/hooks/useVizzyRealtimeVoice.ts`, not a remaining WebRTC transport problem.

Root cause

- In the current code, everything stays inside the original `if (!sdpResp.ok)` block.
- After a 5xx, the code retries with a fully gathered SDP and can replace `sdpResp` with a successful 201 response.
- But the function still reaches the unconditional `throw new Error(...)` at the end of that outer block.
- Result: a recovered SDP exchange is incorrectly reported as failed, and the handshake is aborted before `setRemoteDescription`.

Implementation plan

1. Fix the SDP retry control flow in `src/hooks/useVizzyRealtimeVoice.ts`
- Refactor the SDP POST section so it tracks:
  - initial response
  - retry response
  - final response actually used
  - final error text only if the final response is still non-OK
- After a successful retry, exit the error branch cleanly and continue into:
  - `setStep("sdp_post_ok")`
  - `await sdpResp.text()`
  - `pc.setRemoteDescription(...)`

2. Keep escalation only for true final failures
- Preserve the current ladder:
  - bounded offer
  - full-gather retry on 5xx
  - relay-only retry
  - STUN-only retry
- But only escalate to relay/STUN if the final post attempt still returns 5xx.

3. Tighten diagnostics so logs match reality
- Log whether success came from:
  - `bounded`
  - `full-gather-retry`
- Prevent mixed status/error text like:
  - status `201`
  - body text from prior `500`
- Optionally record the final SDP stage in the debug step so future failures are easier to isolate.

4. Re-verify the post-success path
- Confirm the code reaches:
  - `remote_desc_applied`
  - `waiting_session_created`
  - then `data_channel_open` / `session_created`
- If a new blocker appears after this fix, it will be the real next issue instead of this false negative.

Files to change

- `src/hooks/useVizzyRealtimeVoice.ts`

What should stay unchanged

- TURN token provisioning in the backend
- bounded ICE gather helpers in `src/lib/webrtc/realtimeConnection.ts`
- transceiver-based offer shape
- relay/STUN retry strategy

Technical details

- The strongest evidence is the exact mismatch in the logs:
  - retry request succeeds with `201`
  - thrown error still says `Internal Server Error`
- That can only happen if the code is reusing the old error text and still throwing after the retry has already recovered.
- So the next patch should be minimal and surgical: fix the branching, not redesign the handshake again.
