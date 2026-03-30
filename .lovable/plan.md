

# Add Real Video Trim via Scissors Icon

## Problem
The scissors icon currently only resizes segment duration (timeline width) but doesn't actually trim the video content. The user wants dragging start/end handles to physically trim the video — removing frames from the beginning or end — and apply the result to the clip.

## Current State
- `trimMode` + drag handles exist in `TimelineBar.tsx` but only call `onResizeScene(index, newDuration)` which adjusts `seg.endTime`
- `handleResizeScene` in `ProVideoEditor.tsx` only updates segment timing — no video processing
- `trimVideo(src, startTime, endTime)` exists in `src/lib/videoTrim.ts` — does real canvas-based video trimming
- Clips have no `trimStart`/`trimEnd` offset concept — stitch always plays from 0

## Plan

### 1. Add trim offset tracking to clips — `ProVideoEditor.tsx`
- Add state: `clipTrimOffsets: Record<sceneId, { trimStart: number; trimEnd: number }>`
- When scissors mode drag completes, calculate how much was trimmed from start vs end
- Call `trimVideo(clipUrl, trimStart, trimEnd)` to produce a new blob URL
- Replace the clip's `videoUrl` with the trimmed result
- Update segment timing to match new duration

### 2. Modify drag-to-resize to track start vs end trim — `TimelineBar.tsx`
- **Left handle drag**: Calculate trim-from-start offset (how many seconds removed from beginning)
- **Right handle drag**: Calculate trim-from-end (how many seconds removed from end)
- Pass new callback `onTrimApply(index: number, trimStart: number, trimEnd: number)` instead of just `onResizeScene` when in trim mode
- Show visual feedback: red shaded area on the portion being trimmed

### 3. Implement `handleTrimApply` in `ProVideoEditor.tsx`
```typescript
const handleTrimApply = async (index: number, trimStart: number, trimEnd: number) => {
  const scene = storyboard[index];
  const clip = clips.find(c => c.sceneId === scene.id);
  if (!clip?.videoUrl) return;
  
  // Use existing trimVideo utility
  const trimmedUrl = await trimVideo(clip.videoUrl, trimStart, trimEnd);
  
  // Update clip with trimmed video
  onUpdateClip(scene.id, trimmedUrl);
  
  // Update segment duration to match
  const newDuration = trimEnd - trimStart;
  onUpdateSegmentTiming(seg.id, seg.startTime, seg.startTime + newDuration);
};
```

### 4. Update TimelineBar drag logic for trim mode
- When `trimMode` is active and left handle is dragged right → accumulate `trimStart` seconds
- When right handle dragged left → reduce `trimEnd`
- On mouseUp in trim mode → call `onTrimApply(index, trimStart, trimEnd)` with computed offsets
- Need to know the clip's actual video duration (not just segment duration) to calculate valid trim range

### 5. Add props to TimelineBar
- `onTrimApply?: (index: number, trimStart: number, trimEnd: number) => Promise<void>`
- `clipDurations?: Record<string, number>` (already passed)

## Files Changed
- `src/components/ad-director/editor/TimelineBar.tsx` — trim mode calls `onTrimApply` with start/end offsets
- `src/components/ad-director/ProVideoEditor.tsx` — implement `handleTrimApply` using `trimVideo`, pass to TimelineBar

## Result
Clicking scissors → selecting a scene → dragging left/right handles physically trims the video and applies it to the clip. The trimmed portion is removed from the actual video file.

