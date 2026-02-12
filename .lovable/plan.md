

# Fix Double Voice: Mute RC Audio Element + Echo Tail Guard

## Root Cause

The user hears the AI voice **twice** because:

1. **Local playback** (line 303): AI audio plays directly to the user via `outputCtx.destination`
2. **RC audio element**: The remote caller's phone echoes back the AI voice through their mic. This echo returns on the RingCentral receiver track and plays through the RC SDK's built-in `<audio>` element -- creating a delayed second copy

Additionally, the `ttsPlayingRef` unmutes the mic capture immediately when playback ends, but the echo from the remote phone arrives 200-500ms later, potentially getting sent back to ElevenLabs.

## Changes to `src/hooks/useCallAiBridge.ts`

### 1. Add `audioElementRef` to store and mute the RC audio element

Add a new ref. When the bridge starts, set `callSession.audioElement.volume = 0` so the user only hears the AI through the local playback path. Restore volume on stop/close.

### 2. Echo tail guard -- delay unmuting after TTS ends

Change the `onEnded` callback in `playAiAudioChunk` (lines 285-290) to wait 500ms before setting `ttsPlayingRef.current = false`. This prevents the capture processor from picking up delayed echo from the remote phone.

```text
const onEnded = (src: AudioBufferSourceNode) => {
  activeSourcesRef.current.delete(src);
  if (activeSourcesRef.current.size === 0) {
    setTimeout(() => {
      if (activeSourcesRef.current.size === 0) {
        ttsPlayingRef.current = false;
      }
    }, 500);
  }
};
```

### 3. Handle `interruption` event from ElevenLabs

Add a case for the `interruption` WebSocket message type to immediately stop all TTS playback, improving barge-in responsiveness.

### 4. Restore audio element on cleanup

In `ws.onclose`, `stopBridge`, and `cleanup`, restore `audioElementRef.current.volume = 1`.

## Summary of All Changes

- Add `audioElementRef` ref
- Mute `audioElement.volume = 0` on bridge start
- Add 500ms echo tail guard in `onEnded`
- Add `interruption` case in `handleWsMessage`
- Restore `audioElement.volume = 1` on bridge stop/close
