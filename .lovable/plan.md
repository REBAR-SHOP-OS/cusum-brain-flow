

# Fix: Text Overlay Drag Position & Click-to-Edit

## Problems
1. **Drag snaps to wrong position**: When dropping a purple text bar, `handleMoveOverlay` converts global time to scene-local time and clamps within scene boundaries. If the overlay's duration exceeds the remaining scene time, it gets pushed back.
2. **Click-to-edit conflict**: `onMouseDown` (drag) and `onClick` (edit) are on the same element. Because `e.preventDefault()` is called in `handleItemDragStart`, the `onClick` may not fire reliably after a drag attempt. Need to distinguish click (no movement) from drag (movement).

## Solution (2 files)

### File 1: `src/components/ad-director/editor/TimelineBar.tsx`

**Distinguish click vs drag**: In `onUp` handler, check if `dx` is small (< 3px). If so, treat as click — call `onEditOverlay` for text items instead of moving. Only call `onMoveOverlay` when actual drag occurred.

```typescript
// In onUp (line 308):
const dx = e.clientX - itemDragRef.current.startX;
const isClick = Math.abs(dx) < 3;

if (isClick && itemDragRef.current.type === "text") {
  // Find overlay and trigger edit
  const ov = textOverlays.find(o => o.id === itemDragRef.current!.id);
  if (ov) onEditOverlay?.(ov);
} else if (itemDragRef.current.type === "text") {
  // actual drag — move overlay
  ...
}
```

### File 2: `src/components/ad-director/ProVideoEditor.tsx`

**Fix `handleMoveOverlay` clamping**: The current logic clamps `startTime` within the target scene's duration minus the overlay duration. This prevents placing at the end of a scene. Change to use the global absolute time directly and compute scene-relative start/end correctly, allowing the overlay to span or be placed at any position within the scene.

```typescript
// In handleMoveOverlay (line 1402):
const handleMoveOverlay = useCallback((id: string, newSceneId: string, startTime?: number) => {
  setOverlays(prev => prev.map(o => {
    if (o.id !== id) return o;
    const newSceneIdx = storyboard.findIndex(s => s.id === newSceneId);
    const seg = newSceneIdx >= 0 ? segments.find(s => s.id === storyboard[newSceneIdx]?.segmentId) : null;
    const newDur = seg ? seg.endTime - seg.startTime : 4;
    if (startTime != null) {
      const itemDuration = (o.endTime != null && o.startTime != null) ? (o.endTime - o.startTime) : 3;
      // Allow placing anywhere, just clamp so start >= 0
      const clampedStart = Math.max(0, startTime);
      return { ...o, sceneId: newSceneId, startTime: clampedStart, endTime: clampedStart + itemDuration };
    }
    return { ...o, sceneId: newSceneId };
  }));
}, [storyboard, segments]);
```

## Result
- Dragging a purple text bar and releasing places it exactly where dropped
- Single-clicking a purple text bar opens the edit dialog
- Text overlays apply to the video at their new timeline position

