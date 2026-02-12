

# Fix: Remote Caller Can't Hear AI Voice

## Root Cause

The `AudioContext` is created at **16kHz** sample rate (to match ElevenLabs input format). The AI output destination (`aiDest`) is created on the same 16kHz context. When `replaceOutgoingTrack` swaps the WebRTC sender's audio track with this 16kHz stream, the remote caller receives audio at an unexpected sample rate. WebRTC standard audio is 48kHz, and many browsers/codecs don't properly handle a 16kHz replaced track.

## Solution

Create a **separate AudioContext at 48kHz** (default browser rate) for the AI audio output, and upsample the 16kHz PCM data from ElevenLabs to 48kHz when creating audio buffers for playback.

## Changes to `src/hooks/useCallAiBridge.ts`

### 1. Add a second AudioContext ref for output

Add a new ref `outputCtxRef` for a 48kHz AudioContext used exclusively for the AI output destination and local monitoring.

### 2. Create output context and destination at 48kHz

```text
// Keep 16kHz context for capturing/sending caller audio to ElevenLabs
const audioCtx = new AudioContext({ sampleRate: 16000 });

// Create 48kHz context for AI audio output (WebRTC compatible)
const outputCtx = new AudioContext({ sampleRate: 48000 });
const aiDest = outputCtx.createMediaStreamDestination();
```

### 3. Update `playAiAudioChunk` to upsample

When creating audio buffers for the AI voice, create them at 48kHz on the output context. The browser's `AudioBufferSourceNode` will automatically resample the 16kHz data to 48kHz when the buffer is created at the correct rate:

```text
function playAiAudioChunk(base64Audio, outputCtx, dest) {
  const float32 = pcm16Base64ToFloat32(base64Audio);
  if (float32.length === 0) return;

  // Create buffer at 48kHz - browser resamples from 16kHz source data
  const outputSampleRate = outputCtx.sampleRate; // 48000
  const resampledLength = Math.round(float32.length * (outputSampleRate / 16000));
  const audioBuffer = outputCtx.createBuffer(1, resampledLength, outputSampleRate);
  
  // Simple linear interpolation upsampling
  const channelData = audioBuffer.getChannelData(0);
  const ratio = float32.length / resampledLength;
  for (let i = 0; i < resampledLength; i++) {
    const srcIdx = i * ratio;
    const lower = Math.floor(srcIdx);
    const upper = Math.min(lower + 1, float32.length - 1);
    const frac = srcIdx - lower;
    channelData[i] = float32[lower] * (1 - frac) + float32[upper] * frac;
  }

  // Send to remote caller
  const bufferSource = outputCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(dest);
  bufferSource.start();

  // Local monitoring
  const localSource = outputCtx.createBufferSource();
  localSource.buffer = audioBuffer;
  localSource.connect(outputCtx.destination);
  localSource.start();
}
```

### 4. Update cleanup

Close both AudioContexts on cleanup.

### 5. Update `handleWsMessage` call

Pass `outputCtx` instead of `audioCtx` to `playAiAudioChunk`.

## Expected Result

- Remote caller hears the AI voice clearly (48kHz audio over WebRTC)
- Local user also hears the AI voice for monitoring
- ElevenLabs still receives 16kHz caller audio (unchanged)

