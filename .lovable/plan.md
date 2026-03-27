

# Add Image Overlay to Video Editor (Upload + Drag to Position)

## What We're Building
An "Image" button in the timeline toolbar that lets users upload a photo, which appears as a draggable overlay on the video canvas. Users can drag it to reposition it over the video.

## Changes

### 1. New Component: `ImageOverlayDialog.tsx`
Create `src/components/ad-director/editor/ImageOverlayDialog.tsx` — a dialog with file upload input. On upload, creates a `VideoOverlay` with `kind: "logo"` (which already renders as `<img>`), centered on the current scene.

### 2. Make Overlays Draggable on Canvas
In `ProVideoEditor.tsx` (lines 1569-1590), change image/text overlays from `pointer-events-none` to interactive. Add `onMouseDown`/`onMouseMove`/`onMouseUp` handlers that update the overlay's `position.x` and `position.y` based on mouse drag relative to the video container. This lets users drag any overlay (image, text, logo) to reposition it visually.

### 3. Add "Image" Tab to Timeline Toolbar
In `ProVideoEditor.tsx` (lines 1738-1747), add a new sidebar tab entry:
```
{ id: "image", label: "Image", icon: <ImagePlus className="w-3.5 h-3.5" /> }
```

### 4. Handle "image" Tab Click
When `activeTab === "image"`, open the `ImageOverlayDialog`. On image selected, create overlay and add to `overlays` state.

### 5. Update `VideoOverlay` Type
Add `"image"` to the `kind` union in `src/types/videoOverlay.ts` so we distinguish user-uploaded images from brand logos.

## Technical Details

**Drag Implementation** (on canvas overlay divs):
- `onMouseDown` captures the overlay ID and initial mouse offset
- `onMouseMove` calculates new `x%` and `y%` relative to the video container's bounding rect
- `onMouseUp` finalizes position in state
- Cursor changes to `grab`/`grabbing` during drag

**Files Changed:**
| File | Change |
|------|--------|
| `src/types/videoOverlay.ts` | Add `"image"` to `kind` union |
| `src/components/ad-director/editor/ImageOverlayDialog.tsx` | **New** — upload dialog |
| `src/components/ad-director/ProVideoEditor.tsx` | Add image tab, dialog state, draggable overlays on canvas |

