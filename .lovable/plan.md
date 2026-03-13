

# Add Upload Image Button to Post Review Panel

## Change

### `src/components/social/PostReviewPanel.tsx`

Add an "Upload Image" button alongside the existing "Upload Video" button (line 427-451). The new button will use the same pattern: a hidden `<input type="file" accept="image/*">` wrapped in a `<label>`, calling `handleMediaReady(blobUrl, "image")` on file selection.

Insert the upload image label+button in the second row (line 427), so the layout becomes:
- Row 1: `Regenerate image` | `AI Image`
- Row 2: `Generate video` | `Upload Video`  
- Row 3: `Upload Image` | `Auto Generate Story`

The `Upload` icon (already imported) and `handleMediaReady` (already handles both image and video) are reused — no new imports or logic needed.

