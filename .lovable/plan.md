

# Split Scene at Playhead Position (Scissors Button)

## Problem
The scissors button currently trims 1 second off the end of a scene. The user wants it to **cut/split the scene at the exact playhead position** — wherever the playhead indicator is on the timeline.

## Changes

### 1. `src/components/ad-director/ProVideoEditor.tsx`
- **Modify `handleTrimScene`** (or repurpose it) to split the scene at the current `globalTime` position instead of trimming 1s:
  - Calculate where the playhead is relative to the selected scene: `splitPoint = globalTime - cumulativeStarts[index]`
  - If playhead is at the very start or end of the scene (< 0.5s from edge), show a toast warning and abort
  - Create two segments from the original: first segment `[startTime, startTime + splitPoint]`, second segment `[startTime + splitPoint, endTime]`
  - Create a new scene for the second half, insert it after the current scene
  - Push history for undo support
  - Update segment timings for both halves

### 2. `src/components/ad-director/editor/TimelineBar.tsx`
- Update the scissors button tooltip from `"Trim (-1s)"` to `"Split at playhead"`
- Update context menu label from `"Trim (−1s)"` to `"Split at playhead"`

### Logic
```typescript
const handleTrimScene = useCallback((index: number) => {
  const scene = storyboard[index];
  if (!scene) return;
  const seg = segments.find(s => s.id === scene.segmentId);
  if (!seg) return;
  
  const sceneStart = cumulativeStarts[index] || 0;
  const splitPoint = globalTime - sceneStart; // local time within scene
  const sceneDur = seg.endTime - seg.startTime;
  
  if (splitPoint < 0.5 || splitPoint > sceneDur - 0.5) {
    toast({ title: "Cannot split", description: "Move playhead to the middle of the scene", variant: "destructive" });
    return;
  }
  
  pushHistory(storyboard);
  // Shorten current scene to [startTime, startTime + splitPoint]
  onUpdateSegmentTiming?.(seg.id, seg.startTime, seg.startTime + splitPoint);
  // Create new scene for second half
  const newScene = { ...scene, id: crypto.randomUUID(), segmentId: crypto.randomUUID() };
  const updated = [...storyboard];
  updated.splice(index + 1, 0, newScene);
  onUpdateStoryboard?.(updated);
  toast({ title: "Scene split", description: `Split at ${globalTime.toFixed(1)}s` });
}, [storyboard, segments, globalTime, cumulativeStarts, pushHistory, onUpdateSegmentTiming, onUpdateStoryboard, toast]);
```

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — rewrite `handleTrimScene` to split at playhead
- `src/components/ad-director/editor/TimelineBar.tsx` — update tooltip/label text

