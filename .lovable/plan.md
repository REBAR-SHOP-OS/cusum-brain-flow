

# Fix: Split Scene at Playhead Position

## Problem
Current `handleSplitScene` splits at the **midpoint** of the segment (`(seg.startTime + seg.endTime) / 2`), ignoring the playhead position. It also doesn't create a proper second segment — just a new scene referencing a non-existent segment ID.

## Solution (1 file)

### `src/components/ad-director/ProVideoEditor.tsx` — `handleSplitScene`

Replace the split logic to:

1. **Use `currentTime`** (playhead position within the selected scene) as the split point
2. **Guard**: if playhead is at 0 or at the end, don't split (nothing to cut)
3. **Create two segments** from the original:
   - Segment A: `startTime` → `startTime + currentTime` (first half)
   - Segment B: `startTime + currentTime` → `endTime` (second half)
4. **Update segments** via `onUpdateSegments` — modify original segment's endTime, insert new segment after it
5. **Create new scene** referencing the new segment ID
6. **Reset playhead** to 0 after split

```typescript
const handleSplitScene = useCallback((index: number) => {
  const scene = storyboard[index];
  if (!scene) return;
  const seg = segments.find(s => s.id === scene.segmentId);
  if (!seg) return;

  const sceneDur = seg.endTime - seg.startTime;
  // Use currentTime as split point within the scene
  const splitAt = currentTime;
  if (splitAt <= 0.05 || splitAt >= sceneDur - 0.05) {
    toast({ title: "Cannot split", description: "Move playhead inside the scene first." });
    return;
  }

  pushHistory(storyboard);

  const absoluteSplit = seg.startTime + splitAt;
  const newSegId = crypto.randomUUID();

  // Create two segments: original trimmed + new second half
  const updatedSegments = segments.map(s =>
    s.id === seg.id ? { ...s, endTime: absoluteSplit } : s
  );
  const segIdx = updatedSegments.findIndex(s => s.id === seg.id);
  const newSeg = { ...seg, id: newSegId, startTime: absoluteSplit, endTime: seg.endTime };
  updatedSegments.splice(segIdx + 1, 0, newSeg);
  onUpdateSegments?.(updatedSegments);

  // Insert new scene after current
  const newScene = { ...scene, id: crypto.randomUUID(), segmentId: newSegId };
  const updated = [...storyboard];
  updated.splice(index + 1, 0, newScene);
  onUpdateStoryboard?.(updated);

  setCurrentTime(0);
  toast({ title: "Scene split", description: `Split at ${splitAt.toFixed(1)}s` });
}, [storyboard, segments, currentTime, pushHistory, onUpdateStoryboard, onUpdateSegments, toast]);
```

## Result
- Playhead position determines exactly where the scene is cut
- Two properly-sized segments are created with correct timing
- Both resulting cards show correct thumbnails and durations

