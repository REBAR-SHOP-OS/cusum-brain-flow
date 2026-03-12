

# Fix Image Zoom Dialog Size

## Problem
The zoom dialog currently uses `max-w-[90vw] max-h-[90vh]` which makes it nearly fullscreen. The user wants a more moderate size that doesn't take the entire screen.

## Fix

### `src/components/social/PostReviewPanel.tsx` — Line 915

Change:
```tsx
<DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
  <img src={post.image_url} alt="Full preview" className="w-full h-full object-contain" />
```
To:
```tsx
<DialogContent className="max-w-[60vw] max-h-[70vh] p-4 flex items-center justify-center">
  <img src={post.image_url} alt="Full preview" className="max-w-full max-h-[65vh] object-contain rounded-lg" />
```

This constrains the dialog to 60% width and 70% height of the viewport — large enough to see detail but doesn't overwhelm the screen.

### Files Changed
- `src/components/social/PostReviewPanel.tsx` (line 915-916)

