

# Fix: Duplicate Scene Should Copy the Video Clip

## Problem
When duplicating a scene card, the new scene gets a new `id` but no corresponding entry is added to the `clips` array. Since the timeline looks up video thumbnails via `clips.find(c => c.sceneId === scene.id)`, the duplicated card shows no video.

## Solution

### `src/components/ad-director/ProVideoEditor.tsx` — `handleDuplicateScene` (~line 1029)

Add a new prop `onDuplicateClip?: (oldSceneId: string, newSceneId: string) => void` to `ProVideoEditorProps`, and call it inside `handleDuplicateScene` after creating the new scene:

```tsx
const newSceneId = crypto.randomUUID();
const newScene: StoryboardScene = { ...scene, id: newSceneId, segmentId: ... };
// ...
onDuplicateClip?.(scene.id, newSceneId); // copy the clip entry
```

### `src/components/ad-director/AdDirectorContent.tsx` — pass `onDuplicateClip`

Wire the new prop to clone the matching clip in the service state:

```tsx
onDuplicateClip={(oldId, newId) => {
  const existing = service.getState().clips.find(c => c.sceneId === oldId);
  if (existing) {
    service.patchState({
      clips: [...service.getState().clips, { ...existing, sceneId: newId }],
    });
  }
}}
```

## Files Changed
1. `src/components/ad-director/ProVideoEditor.tsx` — add prop + call in duplicate handler
2. `src/components/ad-director/AdDirectorContent.tsx` — pass `onDuplicateClip` callback

## Result
Duplicated scene cards will immediately show the same video thumbnail and have a "completed" clip status, matching the original card exactly.

