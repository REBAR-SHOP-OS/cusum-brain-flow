

# Fix: Crossfade Creates Visual Overlap and Audio Garbage

## Root Cause

The crossfade logic has a critical double-playback bug:

1. During crossfade, clip N's `drawFrame` loop starts playing clip N+1's video element (`nv.play()` at line 574) and draws it with alpha blending
2. When clip N finishes (`finishClip` → `clipIndex++` → `playNextClip()`), clip N+1 becomes the "current" clip
3. `playNextClip()` then resets `video.currentTime = 0` (line 512) and calls `video.play()` again on the **same video element** that was already playing
4. This creates a visual jump/glitch at every transition boundary
5. Both the old drawFrame loop (briefly) and the new drawFrame loop may run simultaneously on the same video, causing overlap artifacts

Additionally, since each video element is a single `<video>` DOM node reused across crossfade and main playback, resetting `currentTime` mid-playback causes the decoder to seek, producing garbled frames.

## Fix — `src/lib/videoStitch.ts`

Track whether the next clip was already started during crossfade. When `playNextClip` picks up a clip that was pre-started, **skip the reset to currentTime=0** and **skip calling play()** — just let it continue from where the crossfade left off. Adjust `clipStartCumulativeTime` to account for time already elapsed.

### Changes:

1. Add a module-level `Set` or variable tracking which clip indices were pre-started during crossfade
2. In `playNextClip()`: if the clip was already started by crossfade, skip `currentTime = 0` and `video.play()`, just attach the drawFrame loop
3. Clean up the `nextClipStarted` flag properly

```text
Before:
  playNextClip → video.currentTime = 0 → video.play() → drawFrame
  (but video was already playing from crossfade → RESET → glitch)

After:
  playNextClip → detect pre-started → skip reset → attach drawFrame
  (video continues smoothly from crossfade position)
```

### Specific code changes:

**Add tracking variable** (before the `playNextClip` function):
```typescript
let clipPreStartedByCrossfade = false;
```

**In crossfade block** (line ~571): set `clipPreStartedByCrossfade = true` when starting next clip

**In `playNextClip()`** (line ~509-512): 
```typescript
if (clipPreStartedByCrossfade) {
  // Video already playing from crossfade — don't reset
  clipPreStartedByCrossfade = false;
} else {
  video.currentTime = 0;
}
```

**In play section** (line ~615-616): skip `video.play()` if already playing from crossfade, just attach drawFrame directly

## Files
- `src/lib/videoStitch.ts` — fix crossfade double-playback causing visual overlap and audio glitches at transitions

