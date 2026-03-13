

# Add Zoom Icon to Post Card Images

## What
Add a magnifying glass (ZoomIn) icon overlay on images in `PixelPostCard.tsx`. Clicking it opens a medium-sized dialog showing the image larger — not fullscreen.

## Changes

### `src/components/social/PixelPostCard.tsx`
- Import `ZoomIn` from lucide-react and `Dialog`/`DialogContent` from UI
- Add `imageZoomOpen` state
- Wrap the image in a `relative group` container
- Add a ZoomIn button overlay (appears on hover, top-right corner)
- Add a Dialog that shows the image at `max-w-[60vw] max-h-[70vh]` — same pattern as `PostReviewPanel.tsx`

