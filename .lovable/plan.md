

# Deploy and Test Debug Instrumentation

## Status
The debug patch is already shipped — all three changed files are frontend-only (`useVizzyRealtimeVoice.ts`, `useVizzyVoiceEngine.ts`, `VizzyVoiceChat.tsx`). No edge function changes. The preview already has the new code.

## Plan

1. **Navigate to the live app** at `/vizzy-live` using browser tools
2. **Start a voice session** — tap "Start voice session"
3. **Observe the debug step indicator** in the UI as the connection progresses
4. **Capture the last debug step shown** before failure
5. **Read console logs** for the exact error at that step
6. **Read network requests** for any failed HTTP calls
7. **Report findings** — exact step, exact error, no guesses

No code changes in this step. Pure observation using the instrumentation we just added.

