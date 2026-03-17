

## Make Floating Vizzy Button Draggable at All Times

### Problem
The drag handlers (`onPointerDown`, `onPointerMove`, `onPointerUp`) are only attached to the inner avatar `<button>`. When the mic action button appears above it (on hover/mobile), or when the voice chat panel is open, dragging doesn't work on those elements.

### Solution
Move the pointer drag handlers from the inner `<button>` to the outer container `<div>`. This way the entire floating group (avatar + mic button + tooltip) is draggable as one unit. The tap-to-navigate logic stays on the avatar button only (via `onClick` instead of `onPointerUp`).

### File: `src/components/vizzy/FloatingVizzyButton.tsx`

1. **Outer `<div>`**: Add `onPointerDown`, `onPointerMove`, `onPointerUp` handlers to the container div so the whole group is draggable
2. **Inner avatar `<button>`**: Remove pointer handlers, use a simple `onClick` that checks `wasDragged` to decide whether to navigate
3. **Mic button**: Keep `onClick` for voice chat — dragging on it will move the whole group, tapping opens voice chat
4. **VizzyVoiceChat overlay**: No changes needed — it renders as a separate portal, doesn't block the button

This ensures dragging works from any part of the floating button group, regardless of whether the mic action or tooltip is visible.

