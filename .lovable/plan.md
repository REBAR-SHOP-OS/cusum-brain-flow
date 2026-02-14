

# Drag-and-Drop Floating Agent Button

Make the floating agent button (Vizzy/assistant) draggable so users can reposition it anywhere on screen.

## What Changes

The floating agent button in the bottom-right corner will become draggable. You can click and drag it to any position on the screen. A simple click (without dragging) still navigates to the chat page. The button's position persists in localStorage so it stays where you left it between page loads.

## Technical Details

### File Modified

**`src/components/vizzy/FloatingVizzyButton.tsx`**
- Add `useState` for button position (x, y) initialized from localStorage or default bottom-right
- Add mouse/touch event handlers for drag behavior:
  - `onPointerDown`: record start position, set dragging flag
  - `onPointerMove` (on window): update position while dragging
  - `onPointerUp` (on window): end drag, save position to localStorage
- Distinguish click vs drag: only navigate to `/chat` if the pointer moved less than 5px (not a drag)
- Replace the `fixed bottom-X right-X` classes with inline `style={{ left, top }}` positioning
- Clamp position to viewport bounds so the button can't be dragged off-screen
- Add `touch-action: none` CSS for smooth mobile dragging

### No database or other file changes needed

