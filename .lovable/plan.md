

# Drag All Overlays on Video — Already Implemented

## Current State

After reviewing the code, the drag functionality for all overlays is **already implemented** from the previous approved plan:

1. **All overlay types** (text, image, logo) rendered via `sceneOverlays.map()` at lines 1590-1622 already have:
   - `cursor: grab/grabbing` styling
   - `onMouseDown` handler that captures drag offset and sets `draggingOverlayId`

2. **Video container** (line 1528-1538) already has:
   - `onMouseMove` — updates overlay position based on mouse movement
   - `onMouseUp` / `onMouseLeave` — releases drag

3. **Brand watermark** (line 1579-1589) is intentionally NOT draggable — it's a fixed brand badge, not a user-added overlay.

## What May Be Needed

The code is correct. If overlays aren't dragging in the preview, it may be because:
- The preview hasn't refreshed yet with the latest code
- Or the user needs to test by adding an overlay first (via Image or Text tab)

## Recommendation

**Test the feature end-to-end**: Open the video editor, add a text or image overlay, then try dragging it on the video canvas. The grab cursor should appear and the overlay should follow the mouse.

No additional code changes are needed — the drag system is fully wired.

