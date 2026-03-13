

# Fix: Canvas Not Redrawing After Retry

## Root Cause
When "Retry" is clicked, `setPreviewUrl(null)` switches the view from preview back to the canvas. However, the canvas redraw `useEffect` (line 58) has dependencies `[imgLoaded, strokes, currentStroke]` — none of which change when Retry is clicked. Since no dependency changes, the effect doesn't re-run, and the canvas stays blank.

## Fix
Add `previewUrl` to the dependency array of the canvas redraw effect (line 89). When `previewUrl` changes from a URL back to `null`, the effect will re-trigger and redraw the original image on the canvas.

### File: `src/components/social/ImageEditDialog.tsx`
**Line 89:** Change `[imgLoaded, strokes, currentStroke]` → `[imgLoaded, strokes, currentStroke, previewUrl]`

