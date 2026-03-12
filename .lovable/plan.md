

# Fix Image Display — Show at Actual Aspect Ratio

## Problem
Line 362 in `PostReviewPanel.tsx` forces all images to `aspect-square object-cover`, which crops non-square images (e.g. 9:16 story images get cropped to a square).

## Fix

### `src/components/social/PostReviewPanel.tsx` — Line 362
Change:
```tsx
<img src={post.image_url} alt="Post preview" className="w-full aspect-square object-cover" />
```
To:
```tsx
<img src={post.image_url} alt="Post preview" className="w-full object-contain rounded-lg" />
```

`object-contain` preserves the image's native aspect ratio and shows the full image without cropping. The image fills the width and adjusts height naturally.

## Files Changed
- `src/components/social/PostReviewPanel.tsx` (1 line)

