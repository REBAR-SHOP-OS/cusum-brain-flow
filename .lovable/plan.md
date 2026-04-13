
Goal

- Restore `/vizzy-live` on mobile by fixing the realtime WebRTC/control-channel startup path.
- Keep the new lightweight live prompt in place; this looks like a connection problem, not a prompt problem.

What I found

- The backend token path is working:
  - `voice-engine-token` is authenticating successfully
  - it is returning TURN servers
  - no backend failure is showing in the recent logs
- The client repeatedly reaches:
  - `audio_priming`
  - `token_fetch_started`
  - `mic_requesting`
  - `sdp_post_ok`
  - `waiting_session_created`
- The failure signature is consistent with your screenshot and session replay:
  - remote audio track is received
  - data channel stays `connecting`
  - ICE ends `disconnected`
  - relay candidates do exist
- That means the break is after SDP exchange: media partially connects, but the control/data channel never becomes usable.

Implementation plan

1. Harden the offer/ICE strategy in `src/hooks/useVizzyRealtimeVoice.ts`
- Replace the current “send SDP immediately” path with a bounded gather strategy:
  - wait briefly for usable candidates before posting SDP
  - prefer a relay/srflx candidate or ICE complete
  - avoid posting an under-populated offer on mobile
- Make retries change strategy instead of just repeating the same handshake:
  - normal hybrid attempt
  - relay-only retry
  - STUN-only last resort

2. Port the stable channel-handling pattern from `src/hooks/useVoiceEngine.ts`
- Queue pending `session.update` instructions while the data channel is not yet open
- On `data_channel_open`:
  - mark the session connected immediately
  - flush any queued instructions
  - then send the final session config
- Treat `remoteTrackReceived + dc still connecting` as a control-channel timeout case, not a generic session-created wait

3. Keep the mobile-specific fixes already added
- Preserve gesture-primed audio reuse
- Preserve the lightweight `/vizzy-live` prompt path
- Preserve TURN provisioning from the backend

4. Improve diagnostics without changing behavior
- Log which handshake strategy each attempt used
- Log how many ICE candidates were actually included in the SDP that got posted
- Keep clearer error text for the exact failing phase

5. Validate the fix
- Re-test `/vizzy-live` on mobile 5G
- Sanity-check on Wi‑Fi
- Confirm the flow reaches `data_channel_open` and then either `session_created` or the existing connected fallback

Exact files likely to change

- `src/hooks/useVizzyRealtimeVoice.ts`
- `src/lib/webrtc/realtimeConnection.ts` if I add a small helper for bounded candidate gathering
- optionally `src/components/vizzy/VizzyVoiceChat.tsx` only if I need to slightly improve the displayed debug/error text

What stays unchanged

- `src/hooks/useVizzyVoiceEngine.ts` lightweight live prompt setup
- `supabase/functions/voice-engine-token/index.ts` unless a new failure appears
- The `/vizzy-live` UI layout and launch screen

Technical details

- This does not look like a prompt-size issue anymore.
- It also does not look like a token-generation/backend-auth issue.
- The strongest evidence points to a client-side WebRTC negotiation/control-channel problem:
  - SDP post succeeds
  - media can partially connect
  - the SCTP/data channel never reaches `open`
  - therefore no reliable realtime session becomes usable
- The safest minimal fix is to improve the SDP/ICE timing and adopt the more reliable data-channel/open-and-flush pattern already used elsewhere in the codebase.
