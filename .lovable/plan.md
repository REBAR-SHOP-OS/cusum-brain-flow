

# Add Drag-to-Reposition for Text & Audio Track Items

## Problem
Text overlays and audio track items on the timeline are static — their position is locked to their parent scene. The user wants to drag them horizontally to reposition them across different scenes/time positions.

## Approach
Add mouse-based drag handling to the text and audio track items in `TimelineBar.tsx`. On drag-end, update the overlay's `sceneId` and timing to match the new position, and notify the parent via new callback props.

## Changes

### `src/components/ad-director/editor/TimelineBar.tsx`

1. **New props**: `onMoveOverlay?: (id: string, newSceneId: string, newStartPct: number) => void` and `onMoveAudioTrack?: (index: number, newSceneId: string) => void`
2. **Drag state**: Add a ref tracking `{ type: "text"|"audio", id: string|number, startX: number, origLeft: number, origWidth: number }` for the item being dragged
3. **On text/audio item**: Add `onMouseDown` handler that starts drag tracking
4. **Global mousemove/mouseup** (via `useEffect`): During drag, update a local `dragOffsetPct` state to visually shift the item. On mouseup, calculate which scene the center of the dragged item falls into (using `cumulativeStarts`) and call the appropriate move callback.
5. **Visual feedback**: While dragging, apply `translate` transform and a highlight border to the dragged item

### `src/components/ad-director/ProVideoEditor.tsx`

1. **`handleMoveOverlay`**: When a text overlay is moved to a new scene, update its `sceneId` in the `overlays` state, and recalculate `startTime`/`endTime` proportionally for the new scene duration
2. **`handleMoveAudioTrack`**: When a voiceover track is moved to a new scene, update its `sceneId` in `audioTracks` state
3. Pass both handlers as props to `<TimelineBar>`

| File | Change |
|---|---|
| `TimelineBar.tsx` | Add drag-to-reposition logic for text overlay and audio track items |
| `ProVideoEditor.tsx` | Add `handleMoveOverlay` and `handleMoveAudioTrack` callbacks, pass to TimelineBar |

