

# Fix: Editor Shows Old Videos After Scene Regeneration

## Problem
When the user regenerates scenes on the result page and then clicks "Edit Video", the editor still shows the old stitched video. This happens because `finalVideoUrl` (the old stitched video) takes priority over updated individual clip URLs in `ProVideoEditor` (line 534: `finalVideoUrl || selectedClip?.videoUrl`).

## Root Cause
In `handleRegenerateScene`, when a scene is regenerated, `clips` are updated but `finalVideoUrl` is never cleared. Since the editor prioritizes `finalVideoUrl`, it keeps showing the stale stitched video.

## Fix

### `src/components/ad-director/AdDirectorContent.tsx`

**Line 298-299** — When regenerating a scene, also clear `finalVideoUrl`:

```typescript
service.patchState({
  clips: currentState.clips.map(c => c.sceneId === sceneId ? { ...c, status: "generating" as const, progress: 10 } : c),
  finalVideoUrl: null,  // ← ADD THIS: clear stale stitched video
});
```

This single-line addition ensures that after any scene regeneration, the editor will use the individual clip URLs (which reflect the latest generated videos) instead of the old stitched video.

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Add `finalVideoUrl: null` when regenerating a scene to clear stale video |

