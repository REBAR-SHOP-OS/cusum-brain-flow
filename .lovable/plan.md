

# Fix Video Preview to Show Correct Aspect Ratio

## Problem
Line 357 in `PostReviewPanel.tsx` renders uploaded videos with `aspect-video object-cover`, which forces a 16:9 crop regardless of the actual video dimensions. The user wants videos displayed at their native aspect ratio.

## Change

### `src/components/social/PostReviewPanel.tsx` (line 355-361)
Replace the fixed aspect-ratio container with one that adapts to the video's natural dimensions:

```tsx
{isVideo ? (
  <video
    src={post.image_url}
    controls
    className="w-full rounded-lg"
    style={{ maxHeight: '400px' }}
  />
) : (
  <img src={post.image_url} alt="Post preview" className="w-full aspect-square object-cover" />
)}
```

- Remove `aspect-video` and `object-cover` from the `<video>` tag so it renders at its native aspect ratio
- Add `maxHeight: 400px` to prevent extremely tall videos from dominating the panel
- Keep the parent `rounded-lg overflow-hidden bg-muted` wrapper for visual consistency

This is a single-line fix — the video element will naturally size itself to match the source dimensions.

