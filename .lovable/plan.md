## Goal
Make the "Upload Video" button in the post review panel accept `.webm` files explicitly (some OS file pickers filter them out under bare `video/*`).

## Change
- `src/components/social/PostReviewPanel.tsx` (line 940): change `accept="video/*"` → `accept="video/*,video/webm,.webm,.mp4,.mov,.m4v"` so webm is always selectable.
- `src/components/social/VideoLibrary.tsx` (line 111): same update on the Video Library upload input for consistency.

No backend changes — `uploadSocialMediaAsset` already routes all video blobs through `normalizeForInstagram`, which handles webm input.
