

# Upload Video as New Card (Don't Replace Existing)

## Problem
Currently, clicking "Upload" in the Media panel replaces the selected scene's video. The user wants uploaded videos to create a **new scene card** in the timeline while preserving the existing one.

## Changes

### 1. Add `onAddSceneWithMedia` prop — `ProVideoEditor.tsx`
- Add new prop `onAddSceneWithMedia?: (url: string, fileName: string) => void`
- Implement handler that:
  - Creates a new `StoryboardScene` with a unique ID
  - Creates a new `ScriptSegment` with timing after the last segment
  - Creates a new `ClipOutput` with the uploaded blob URL
  - Appends all three to the existing arrays via `onUpdateStoryboard`, `onUpdateSegments`, and the clips state
  - Selects the new scene in the timeline

### 2. Add `onAddSceneWithMedia` in `AdDirectorContent.tsx`
- Pass the prop from `AdDirectorContent` to `ProVideoEditor`
- Implementation: creates new segment + storyboard scene + clip entries in the service state

### 3. Update `MediaTab.tsx` — Upload adds new card
- Add `onAddSceneWithMedia` prop
- Change `handleFileChange`: instead of calling `onUpdateClipUrl(scene.id, url)` (which replaces), call `onAddSceneWithMedia(url, file.name)` to create a new card
- Keep "Replace media" label changed to just "Media" with Upload creating new scenes
- Optionally add a separate "Replace" button that uses the old behavior

### 4. Implementation detail

```typescript
// In ProVideoEditor or AdDirectorContent:
const handleAddSceneWithMedia = (url: string, fileName: string) => {
  const newId = crypto.randomUUID();
  const segId = crypto.randomUUID();
  const lastSeg = segments[segments.length - 1];
  const startTime = lastSeg ? lastSeg.endTime : 0;
  const duration = 5; // default 5s

  const newSegment: ScriptSegment = {
    id: segId, type: "visual", label: fileName,
    text: "", startTime, endTime: startTime + duration,
  };

  const newScene: StoryboardScene = {
    id: newId, segmentId: segId,
    objective: fileName, visualStyle: "custom",
    shotType: "medium", cameraMovement: "static",
    environment: "", subjectAction: "", emotionalTone: "",
    transitionNote: "cut", generationMode: "turbo",
    continuityRequirements: "", prompt: "",
    continuityLock: false, locked: false,
  };

  const newClip: ClipOutput = {
    sceneId: newId, status: "completed",
    videoUrl: url, progress: 100,
  };

  // Append to state
  onUpdateStoryboard([...storyboard, newScene]);
  onUpdateSegments([...segments, newSegment]);
  // Add clip via service.patchState
};
```

## Files Changed
- `src/components/ad-director/editor/MediaTab.tsx` — Upload creates new scene instead of replacing
- `src/components/ad-director/ProVideoEditor.tsx` — add handler + pass to MediaTab
- `src/components/ad-director/AdDirectorContent.tsx` — wire up clip creation for new scene

## Result
Uploading a video via the Media panel creates a new card in the timeline. The existing video remains untouched. The new card appears at the end of the timeline with the uploaded video.

