

## Plan: Add Edit Image Button to Pixel Post Card

### What
Add the "Edit Image" icon/button to `PixelPostCard` (the post cards shown in the Pixel agent chat), with the full `ImageEditDialog` functionality — canvas painting, brush controls, reference image upload, AI inpainting, and preview-then-confirm workflow.

### Changes

**1. `src/components/social/PixelPostCard.tsx`**
- Import `Pencil` icon from lucide-react and `ImageEditDialog` from `./ImageEditDialog`
- Add `onEditImage?: (post: PixelPostData, newUrl: string) => void` prop
- Add `showImageEdit` state
- Add an edit (pencil) icon button on the image overlay (next to the existing zoom button)
- Render `ImageEditDialog` with `post.imageUrl`, and on confirm update the post's image URL via the callback

**2. `src/components/social/PixelChatRenderer.tsx`**
- Pass `onEditImage` handler through to `PixelPostCard`
- When an edited image is confirmed, update the post's `imageUrl` in local state so the card reflects the new image immediately

### Files to modify
- `src/components/social/PixelPostCard.tsx`
- `src/components/social/PixelChatRenderer.tsx`

