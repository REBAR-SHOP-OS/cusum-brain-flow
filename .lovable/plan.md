
Root cause:
- The new `useVizzyRealtimeVoice.ts` hook is too minimal compared to the older working realtime engine.
- It marks the session as connected right after SDP completes, but it does not complete the realtime turn-taking protocol reliably.
- Most importantly, it never triggers an initial `response.create` after `session.created`, and it does not react to `session.updated`.
- It also starts the session before business context finishes loading, then never pushes the refreshed prompt once `vizzy-pre-digest` / `vizzy-daily-brief` completes unless a tool result happens later.
- Result: the UI shows “Listening…”, user speech can be transcribed, but the model often stays idle and never answers.

What I will change:
1. Harden `src/hooks/useVizzyRealtimeVoice.ts`
- Handle realtime protocol events like the older engine:
  - `session.created`
  - `session.updated`
  - `response.audio.started`
  - `response.audio.done`
  - `output_audio_buffer.speech_started`
  - `output_audio_buffer.speech_stopped`
- Move “connected” state to data-channel/session readiness instead of only SDP completion.
- Send a guarded initial `response.create` after `session.created` so the session is fully primed.
- After `conversation.item.input_audio_transcription.completed`, trigger `response.create` if the server is not auto-responding.
- Add connection-state/data-channel-state logging and safer cleanup/reconnect guards.

2. Fix prompt/context timing in `src/hooks/useVizzyVoiceEngine.ts`
- After pre-digest / daily-brief finishes loading, immediately call `engine.updateSessionInstructions(...)`.
- Keep the current “listen first” behavior, but ensure the live session actually receives the final business-aware instructions once context arrives.
- Also push refreshed instructions during the time-sync interval, not just rebuild them locally.

3. Keep the current mobile audio fix
- Preserve the primed audio element pattern already added.
- Keep `outputAudioBlocked` + retry button as fallback.

4. Validation after implementation
- Verify session lifecycle:
  - start session
  - data channel opens
  - `session.created` arrives
  - user speaks
  - user transcript appears
  - Vizzy answers with transcript + audio
- Verify business context still loads after connect and updates the live session.
- Verify no regression on mute/end-session/audio-unlock behavior.

Files to edit:
- `src/hooks/useVizzyRealtimeVoice.ts`
- `src/hooks/useVizzyVoiceEngine.ts`

Risk level:
- Low to medium
- Frontend-only fix, no database changes
- No backend schema changes
- Small chance of duplicate responses if both server VAD auto-response and manual `response.create` fire, so I’ll add guards to prevent double-triggering
