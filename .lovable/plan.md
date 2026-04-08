
# Fix Vizzy Voice Timeout and Slow Replies

## Diagnosis

Do I know what the issue is? Yes.

This is no longer mainly a token-creation problem.

What I confirmed from the code and logs:
- `voice-engine-token` is succeeding repeatedly in roughly `250–600ms`, so the token endpoint is now healthy.
- `vizzy-pre-digest` is very slow (`~78s` in logs), but it runs in parallel and is not the direct cause of the timeout.
- The timeout toast comes from the client timer in `src/hooks/useVoiceEngine.ts`, not from the backend.
- The voice UI only marks the session as connected when it receives `session.created` or `session.updated` over the realtime data channel.
- The WebRTC SDP handshake is still using the older realtime URL pattern, while current docs use the newer WebRTC call endpoint.
- After connect, the client does not explicitly trigger an initial response, so Vizzy may connect but still stay silent instead of greeting/responding immediately.
- The UI also treats `contextLoading` as “still connecting”, so even a live session can look broken while Vizzy Brain is still loading.

## Root Causes

1. `useVoiceEngine` has a brittle readiness check:
   - it waits for specific data-channel events instead of treating WebRTC/data-channel open as a successful connection.

2. The WebRTC client path is outdated:
   - SDP is posted to the legacy realtime endpoint instead of the newer WebRTC calls endpoint.

3. Vizzy Brain loading is too slow and is mixed into the transport UX:
   - users see “connecting” for too long even though the actual voice session should be usable.

4. Vizzy is not kicked off proactively:
   - no guaranteed `response.create`/startup response after session establishment.

## Implementation Plan

### 1) Repair the realtime connection lifecycle
Update `src/hooks/useVoiceEngine.ts` to:
- switch the SDP POST to the current WebRTC endpoint
- clear the timeout and mark the session connected when either:
  - the data channel opens, or
  - the peer connection becomes `connected`
- keep `session.created/session.updated` as secondary signals, not the only success condition
- add stage-specific diagnostics so failures are clearly separated into:
  - mic permission
  - token fetch
  - SDP exchange
  - data-channel open
  - post-connect response failure

### 2) Make Vizzy speak immediately after connect
In `src/hooks/useVoiceEngine.ts` / `src/hooks/useVizzyVoiceEngine.ts`:
- send the session instructions on open
- trigger an initial short Vizzy response after connection so the session is visibly alive
- keep server VAD for normal turn-taking after that

This solves the “connected but silent” behavior.

### 3) Separate “voice connected” from “brain syncing”
Update `src/components/vizzy/VizzyVoiceChat.tsx` so:
- `voiceState === connected` shows `LIVE SESSION` immediately
- `contextLoading` becomes a secondary non-blocking state such as:
  - “Vizzy Brain syncing...”
- the large blocking “connecting” overlay is only shown for actual transport connection, not for digest loading

This fixes the false-offline / fake-reconnecting experience.

### 4) Make Vizzy Brain fast enough for real use
Optimize `vizzy-pre-digest` behavior so Vizzy can always answer from brain quickly:
- add a short-TTL cached digest path for the latest valid brain snapshot
- start voice with the freshest cached Vizzy Brain immediately
- refresh the digest in the background and inject the updated instructions live with `session.update`

Goal:
- first response is fast
- answers still come from Vizzy Brain, not generic model memory

### 5) Align the other realtime path too
Update `src/components/vizzy/VizzyCallHandler.tsx` to use the same corrected realtime handshake/model flow, so phone-call voice sessions do not keep a second broken implementation.

### 6) Validation
After implementation I will verify all of these:
- token endpoint still returns `client_secret`
- WebRTC connects within a few seconds
- UI shows `LIVE SESSION` instead of hanging on `CONNECTING`
- Vizzy gives an immediate startup response
- speaking to Vizzy gets a fast spoken reply
- delayed `vizzy-pre-digest` no longer blocks the voice session
- once digest arrives, updated Vizzy Brain context is injected live
- the call-handler path uses the same stable connection behavior

## Files to Update

- `src/hooks/useVoiceEngine.ts`
- `src/hooks/useVizzyVoiceEngine.ts`
- `src/components/vizzy/VizzyVoiceChat.tsx`
- `src/components/vizzy/VizzyCallHandler.tsx`
- `supabase/functions/vizzy-pre-digest/index.ts` (for fast cached brain delivery)

## Expected Outcome

Vizzy should:
- connect reliably
- stop timing out falsely
- stop showing offline while brain data is still loading
- answer quickly
- always answer using Vizzy Brain context, with refreshed intelligence injected as soon as it is ready
