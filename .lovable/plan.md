

# Fix: AI Goes Silent After Greeting (Root Cause Investigation + Fix)

## The Real Problem

We've tuned the echo tail guard and energy gate twice now, and the AI still dies after the greeting. The parameter tweaks aren't the root cause. The issue is likely one of two deeper problems that we need to diagnose and fix simultaneously:

### Likely Cause 1: `ttsPlayingRef` never resets properly

The greeting arrives as many rapid audio chunks. Each chunk sets `ttsPlayingRef = true` and creates a `BufferSource`. Because chunks overlap (next starts before previous ends), the `onEnded` callback fires for early chunks while later ones are still in `activeSourcesRef`. The 800ms timer only starts when the set is empty. But if timers from earlier chunks fire while the set was temporarily empty between chunk arrivals, and then a late chunk arrives after the timer already ran, the ref might get stuck in an inconsistent state.

### Likely Cause 2: Silent capture -- no audio actually reaching the processor

The 16kHz `captureCtx` captures from a `MediaStream` that wraps the receiver track. If the `ScriptProcessorNode` (deprecated API) fails silently or the resampling from 48kHz to 16kHz produces near-zero samples, the energy gate filters everything out. We have no visibility into this currently.

## Solution: Add Diagnostic Logging + Make Capture More Robust

**File: `src/hooks/useCallAiBridge.ts`**

### 1. Add state-change logging for `ttsPlayingRef`

Wrap every mutation of `ttsPlayingRef.current` in a console.log so we can see exactly when mic capture is muted/unmuted and why. This is critical for diagnosing the next test call.

### 2. Add periodic audio level logging in `onaudioprocess`

Every ~2 seconds, log the current RMS level and whether `ttsPlayingRef` is blocking. This tells us:
- Is audio actually flowing from the remote track?
- Is the energy gate filtering it?
- Is `ttsPlayingRef` stuck on true?

### 3. Remove the energy gate temporarily

Set threshold to 0 (pass all audio). The echo tail guard alone should handle echo suppression. If the conversation works without the energy gate, we know the gate was too aggressive. We can re-add it later with a calibrated value.

### 4. Force `ttsPlayingRef = false` after a safety timeout

Add a global safety mechanism: if `ttsPlayingRef` has been true for more than 15 seconds continuously (no audio chunk should take that long), force it to false. This prevents permanent mic muting from edge cases.

## Technical Details

### Change 1 -- Diagnostic logging in `onaudioprocess` (lines 124-139)

```text
// Add a frame counter and periodic logging
let frameCount = 0;
processor.onaudioprocess = (e) => {
  frameCount++;
  const samples = e.inputBuffer.getChannelData(0);
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const rms = Math.sqrt(sumSq / samples.length);
  
  // Log every ~2s (16000Hz / 2048 buffer = ~7.8 frames/sec, so every 16 frames)
  if (frameCount % 16 === 0) {
    console.log(`AI bridge audio: rms=${rms.toFixed(4)}, ttsPlaying=${ttsPlayingRef.current}, wsOpen=${ws.readyState === WebSocket.OPEN}`);
  }
  
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ttsPlayingRef.current) return;
  // Remove energy gate for now -- let all audio through
  // if (rms < 0.005) return;
  
  const pcm16 = float32ToPcm16(samples);
  const b64 = arrayBufferToBase64(pcm16.buffer);
  ws.send(JSON.stringify({ user_audio_chunk: b64 }));
};
```

### Change 2 -- Log ttsPlaying state changes in `playAiAudioChunk` (line 343)

```text
// Before setting true:
console.log("AI bridge: ttsPlaying -> true (chunk received)");
ttsPlayingRef.current = true;

// In onEnded, before setting false:
console.log("AI bridge: ttsPlaying -> false (all chunks ended + 800ms)");
ttsPlayingRef.current = false;
```

### Change 3 -- Safety timeout for stuck ttsPlaying in `beginAudioCapture`

```text
// After setting up onaudioprocess, add a repeating safety check:
const ttsWatchdog = setInterval(() => {
  if (ttsPlayingRef.current && activeSourcesRef.current.size === 0) {
    console.warn("AI bridge: ttsPlaying stuck on true with no active sources, forcing false");
    ttsPlayingRef.current = false;
  }
}, 3000);
// Store interval ref for cleanup
```

## Files Modified

- `src/hooks/useCallAiBridge.ts` -- diagnostic logging, remove energy gate, add ttsPlaying watchdog

## Expected Outcome

- Console logs will show exactly what's happening during the next test call
- If `ttsPlayingRef` was stuck, the watchdog will unstick it within 3 seconds
- If the energy gate was filtering caller audio, removing it will let audio through
- The logs will definitively tell us whether audio is flowing, being blocked, or absent

