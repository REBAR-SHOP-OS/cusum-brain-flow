

# Fix: Blank Exported Video + End Card UI Not Updating

## Problems Identified

1. **Exported video is blank/gray**: The canvas capture loop has a race condition. After `video.play()` resolves, `drawFrame()` starts immediately, but the first check `if (video.paused || video.ended || ...)` can evaluate `video.paused` as true momentarily or `video.currentTime` as 0 while the browser is still buffering. The loop exits before any frames are drawn.

2. **UI shows "7/7 clips ready" without "+end card"**: The `endCardEnabled` toggle state is `false` — the FinalPreview code is correct but the toggle needs to be on. This is a user action issue, but the fact that a previous export already ran with 7 scenes at 35s suggests the export also didn't respect end card, confirming `endCardEnabled` was off during that export.

## Root Cause: Canvas Capture Race Condition

In `videoStitch.ts` line 299:
```typescript
if (video.paused || video.ended || video.currentTime >= effectiveDuration) {
```

After `video.play()`, the browser may not have decoded the first frame yet. The `video.paused` can flicker, or `video.currentTime` stays at 0 while `effectiveDuration` is also being checked. Additionally, if a clip's blob URL doesn't decode properly, `video.play()` resolves but the video never actually advances.

## Solution

### 1. Fix canvas capture timing (`src/lib/videoStitch.ts`)
- Wait for the `playing` event before starting the `drawFrame` loop (ensures first frame is decoded)
- Add a `setTimeout`-based frame loop as backup alongside `requestAnimationFrame` (RAF pauses when tab is hidden)
- Guard the exit condition: only exit when `video.currentTime > 0` AND `>= effectiveDuration`, preventing premature exit on frame 0
- Add console logs for debugging each clip transition

### 2. Ensure end card default is `true` (`AdDirectorContent.tsx`)
- Check if `endCardEnabled` initializes to `true` — if not, set the default so the UI and export behavior match expectations out of the box

## Files Modified
- `src/lib/videoStitch.ts` — fix race condition in playback loop, add `playing` event gate, guard exit on frame 0
- `src/components/ad-director/AdDirectorContent.tsx` — verify/fix `endCardEnabled` default state

