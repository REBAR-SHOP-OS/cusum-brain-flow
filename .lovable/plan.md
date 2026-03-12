

# Add Video Upload Button to Post Review Panel

## What
Add an "Upload Video" button (with a file upload icon) next to the existing action buttons in `PostReviewPanel.tsx`. When clicked, it opens a native file picker for video files. The selected video gets uploaded to storage via the existing `handleMediaReady` flow and attached to the post — making it schedulable and publishable just like images.

## How

### File: `src/components/social/PostReviewPanel.tsx`

1. **Add `Upload` icon** to the imports (line 2) — add `Upload` from lucide-react.

2. **Add a hidden file input + upload button** in the action button row (lines 379-414):
   - Add a hidden `<input type="file" accept="video/*">` element.
   - Add a new `<Button>` with the `Upload` icon labeled "Upload Video" that triggers the file input.
   - On file selection, create a local blob URL and call the existing `handleMediaReady(blobUrl, "video")` which handles upload to storage + attaching to the post.

The video will then be stored permanently, shown in the post preview (the existing `<video>` player at line 357 already handles video URLs), and can be scheduled/published through the normal flow.

**No database changes needed** — `image_url` column already stores both image and video URLs.

