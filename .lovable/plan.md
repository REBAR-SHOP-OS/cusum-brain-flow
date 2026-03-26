

# Sync Text & Audio with Professional Fade-Out at Video End

## Problem
When the stitched video reaches the end of the last clip, audio (voiceover + music) and subtitle text cut off abruptly — no fade-out, no graceful ending. This sounds unprofessional.

## Root Causes
1. **Audio abrupt stop**: In `videoStitch.ts`, when the last clip finishes, `recorder.stop()` is called and then `onstop` does `voiceElement.pause()` / `musicElement.pause()` — instant silence with no fade.
2. **Music during end card**: Music doesn't fade out before/during the end card — it either keeps playing or cuts.
3. **Voice extends past video**: The voiceover `<audio>` element plays independently from the video clips. If voice is longer than total video, it plays past the end. If shorter, it just stops mid-video with no fade.

## Fix

### `src/lib/videoStitch.ts`

**1. Fade out audio before stopping recorder (last clip ending)**
- In `finishClip()`, when `clipIndex` is the last clip (and no end card), apply a 0.5s gain ramp-down on both voice and music before calling `recorder.stop()`.
- Use `audioCtx.currentTime` + `linearRampToValueAtTime(0, now + 0.5)` on gain nodes.

**2. Fade out music during end card**
- At the start of `renderEndCard()`, ramp music gain to 0 over ~2 seconds.
- Pause voice immediately (or fade it too if still playing).

**3. Stop voice when video content ends**
- After the last clip finishes (before end card), pause the voiceover element so it doesn't bleed into the end card.

**4. Add gain nodes for voice (currently connects directly)**
- Wrap voice in a controllable `GainNode` (like music already has `musicGainNode`) so we can fade it out programmatically. Store as `voiceGainNode`.

### Implementation Detail

```typescript
// New: voiceGainNode alongside musicGainNode
let voiceGainNode: GainNode | null = null;

// In audio setup, voice gain:
voiceGainNode = audioCtx.createGain();
voiceGainNode.gain.value = 1.4;
voiceSource.connect(voiceGainNode);
voiceGainNode.connect(compressor);

// New helper:
const fadeOutAudio = (durationSec = 0.5): Promise<void> => {
  if (!audioCtx) return Promise.resolve();
  const now = audioCtx.currentTime;
  if (voiceGainNode) {
    voiceGainNode.gain.setValueAtTime(voiceGainNode.gain.value, now);
    voiceGainNode.gain.linearRampToValueAtTime(0, now + durationSec);
  }
  if (musicGainNode) {
    musicGainNode.gain.setValueAtTime(musicGainNode.gain.value, now);
    musicGainNode.gain.linearRampToValueAtTime(0, now + durationSec);
  }
  return new Promise(res => setTimeout(res, durationSec * 1000));
};

// In playNextClip(), when all clips done and no end card:
if (overlays?.endCard?.enabled) {
  renderEndCard();
} else {
  // Fade out audio professionally, then stop
  fadeOutAudio(0.5).then(() => {
    if (recorder.state === "recording") recorder.stop();
  });
}

// In renderEndCard(): fade voice immediately, fade music over 2s
if (voiceElement) voiceElement.pause();
if (musicGainNode && audioCtx) {
  const now = audioCtx.currentTime;
  musicGainNode.gain.linearRampToValueAtTime(0, now + 2);
}
```

## Files Changed

| File | Change |
|---|---|
| `src/lib/videoStitch.ts` | Add `voiceGainNode`, implement `fadeOutAudio()` helper, apply fade-out at end of last clip and during end card |

