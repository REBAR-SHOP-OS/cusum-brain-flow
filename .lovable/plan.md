

# Sync Audio/Text/Video & Add Live Thumbnails to Timeline

## Problem
1. Audio, text, and video can desync — no enforcement mechanism ensures they stay aligned
2. Timeline video track shows only colored blocks with text labels — no visual preview of what each scene contains

## Changes

### 1. Live Thumbnail Previews in Timeline — `TimelineBar.tsx`

**What**: When a clip has `videoUrl`, extract a thumbnail frame and display it as the background of that timeline segment instead of a plain colored block.

**How**:
- Create a helper component `SceneThumbnail` that loads a `<video>` element offscreen, seeks to 0.5s, draws a frame to a tiny canvas, and caches the result as a data URL
- Use `useMemo` + `useEffect` to generate thumbnails only when `clip.videoUrl` changes
- Display the thumbnail as `backgroundImage` on the timeline segment div (with `object-fit: cover` via `bg-cover bg-center`)
- Keep the existing label overlay on top with a subtle dark gradient for readability

**Visual result**: Each completed scene shows a small frame from its video in the timeline bar, giving a true "live preview" feel.

### 2. Audio/Text/Video Sync Enforcement — `videoStitch.ts`

**What**: Ensure subtitle text appears/disappears precisely aligned with voiceover timing, and both stay in sync with the video frames.

**How**:
- In the `drawSubtitle` function, use `elapsed` time (which is already derived from the same clock as video playback) to determine which subtitle segment to show — this is already the mechanism in place
- Add a guard: if voiceover audio (`voiceElement`) has drifted more than 0.3s from the video's elapsed time, resync it by setting `voiceElement.currentTime`
- Add the same drift check for music element
- This ensures that even if audio buffers or lags, it snaps back to match the video timeline

**Key code addition** in the render loop (`drawFrame` or equivalent):
```typescript
// Drift correction: keep voice & music in sync with video elapsed time
if (voiceElement && Math.abs(voiceElement.currentTime - elapsed) > 0.3) {
  voiceElement.currentTime = elapsed;
}
if (musicElement && Math.abs(musicElement.currentTime - elapsed) > 0.3) {
  musicElement.currentTime = elapsed;
}
```

## Files Changed

| File | Change |
|---|---|
| `src/components/ad-director/editor/TimelineBar.tsx` | Add `SceneThumbnail` component that extracts video frame; use as background for each timeline scene segment |
| `src/lib/videoStitch.ts` | Add audio drift correction in render loop to keep voice/music synced with video elapsed time |

