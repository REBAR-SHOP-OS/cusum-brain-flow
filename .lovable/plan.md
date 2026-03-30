

# Add Resize Handles to Image/Logo Overlays on Video Canvas

## Problem
When dragging image overlays on the video canvas, users can only move them — there's no way to resize. The user wants resize handles (corners/edges) so they can make images bigger or smaller directly on the canvas.

## Changes

### File: `src/components/ad-director/ProVideoEditor.tsx`

**1. Add resize state tracking**
- New state: `resizingOverlay: { id: string, handle: string } | null`
- New ref: `resizeStart` to track initial mouse position and initial overlay size

**2. Add resize handles to image/logo overlays (lines 1602-1633)**
- When an overlay is of kind `"logo"` or `"image"`, render 4 corner resize handles (small squares at corners)
- Each handle triggers `onMouseDown` that sets `resizingOverlay` state instead of `draggingOverlayId`
- Handles: `nw`, `ne`, `sw`, `se` (northwest, northeast, southwest, southeast)

**3. Update mouse move handler (lines 1541-1547)**
- If `resizingOverlay` is set, calculate delta from start position and update overlay `size.w` and `size.h` (percentage-based)
- For corner handles, adjust both width and height proportionally
- Clamp values to reasonable min (5%) and max (90%)
- For `nw`/`ne` handles, also adjust position to keep opposite corner anchored

**4. Update mouse up/leave handlers (lines 1548-1549)**
- Clear `resizingOverlay` state alongside `draggingOverlayId`

**5. Visual styling for resize handles**
- Small white squares (8x8px) with border at each corner
- Only visible on hover or when overlay is selected/being dragged
- `cursor: nwse-resize` / `nesw-resize` depending on corner

## Files Changed
- `src/components/ad-director/ProVideoEditor.tsx` — add resize handles and resize logic to overlay rendering

