# Add image/video download in PostReviewPanel

Add a small Download icon button next to the existing Zoom (🔍) button on the media preview in `src/components/social/PostReviewPanel.tsx` (around lines 855–860). Behavior:

- Visible for both images and videos (currently zoom only shows for images — download button will show for both).
- Uses existing `downloadFile(url, filename)` helper from `src/lib/downloadUtils.ts` (already handles Supabase storage, signed URLs, blob fallback).
- Filename derived from `post.title` + extension inferred from URL (`.mp4` for video, otherwise `.jpg/.png/.webp` from URL or default `.jpg`).
- Same styling as the zoom button (absolute, top-2, right-10, hover-reveal), with `lucide-react` `Download` icon.
- Stops propagation so it doesn't open the zoom dialog.

No backend, no schema, no other surfaces touched — purely a UI affordance on the existing preview.