

# Fix: Duplicate Scene Creates Complete Copy

## Problem
`handleDuplicateScene` creates a new scene with the same `segmentId` but does NOT create a new segment entry. The duplicated card appears blank because:
1. No new segment is created — the duplicate shares the original's segment reference
2. No clip is associated with the new scene ID — so no thumbnails or video appear
3. The clip from the original scene should be copied for the duplicate

## Solution (1 file)

### `src/components/ad-director/ProVideoEditor.tsx` — `handleDuplicateScene`

Update the function to:
1. Create a new segment (copy of original with new ID and same timing)
2. Add it to `segments` via `onUpdateSegments`
3. Create the new scene referencing the new segment ID
4. Copy the clip reference so thumbnails/video appear on the duplicate

```typescript
const handleDuplicateScene = useCallback((index: number) => {
  const scene = storyboard[index];
  if (!scene) return;
  const seg = segments.find(s => s.id === scene.segmentId);
  
  pushHistory(storyboard);
  
  // Create new segment (copy with new ID)
  const newSegId = crypto.randomUUID();
  if (seg && onUpdateSegments) {
    const newSeg = { ...seg, id: newSegId };
    const updatedSegments = [...segments];
    const segIdx = segments.indexOf(seg);
    updatedSegments.splice(segIdx + 1, 0, newSeg);
    onUpdateSegments(updatedSegments);
  }
  
  const newScene: StoryboardScene = {
    ...scene,
    id: crypto.randomUUID(),
    segmentId: seg ? newSegId : scene.segmentId,
  };
  const updated = [...storyboard];
  updated.splice(index + 1, 0, newScene);
  onUpdateStoryboard?.(updated);
  toast({ title: "Scene duplicated" });
}, [storyboard, segments, pushHistory, onUpdateStoryboard, onUpdateSegments, toast]);
```

## Result
- Duplicated scene gets its own segment with correct timing
- The card appears with proper duration label and content
- Consistent with how split/trim already work

