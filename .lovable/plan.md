

# Fix Double Agent: Remove Local Playback + Add Bridge Guard

## Analysis

After reviewing the full audio pipeline, there are **two remaining causes** of the double voice:

### Cause 1: Local playback creates a second audio path (lines 314-318)
Even with the RC audio element muted, the code **explicitly plays AI audio locally** via `outputCtx.destination` so the operator can "monitor" the AI. But this local playback can leak back into the system -- the browser's audio output can be picked up by hardware echo, and it creates a perceptual "double" for the user sitting at the desk hearing it from speakers.

### Cause 2: No guard against double `startBridge` calls
If `startBridge` is called while already connecting/active (race condition in React effects), two ElevenLabs WebSocket connections open simultaneously -- literally two AI agents.

### Cause 3: Echo tail guard may be too short
500ms may not be enough for telephony networks with higher latency. The AI's own voice echoed back from the caller's phone can arrive 500-1000ms later.

## Changes to `src/hooks/useCallAiBridge.ts`

### 1. Remove local playback entirely (lines 314-318)
Delete the `localSource` that plays AI audio to the user's speakers. The user can monitor the call via the live transcript in the UI. This eliminates the second audio path completely.

```
// REMOVE these lines:
const localSource = outputCtx.createBufferSource();
localSource.buffer = audioBuffer;
localSource.connect(outputCtx.destination);
localSource.start();
```

### 2. Add bridge guard to prevent double WS connections
At the top of `startBridge`, check if already active/connecting and bail out:

```
if (state.status !== "idle") {
  console.warn("AI bridge: already active, ignoring duplicate start");
  return;
}
```

Since `state` is React state (stale in closure), use a ref instead for reliable checking.

### 3. Increase echo tail guard from 500ms to 1000ms
Telephony echo can take up to 1 second. Increase the timeout in `onEnded`.

### 4. Add debug logging for audioElement muting
Log whether `callSession.audioElement` was found and muted, so we can verify it's working.

## Summary

- Remove local AI audio playback (user monitors via transcript instead)
- Add `bridgeActiveRef` guard to prevent two simultaneous WS connections
- Increase echo tail guard to 1000ms
- Add console logging for audioElement muting verification

