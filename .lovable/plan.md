

# Add Magnifying Glass Icon for Full Image Preview

## Problem
Users cannot easily view the full image at a larger size from the post review panel.

## Solution
Add a `ZoomIn` icon button overlaid on the image preview. Clicking it opens a full-screen dialog showing the image at its natural size.

## Changes

### `src/components/social/PostReviewPanel.tsx`

1. **Add imports**: Add `ZoomIn` to lucide imports, add `Dialog, DialogContent` from ui/dialog
2. **Add state**: `const [imageZoomOpen, setImageZoomOpen] = useState(false);`
3. **Wrap image in relative container** (line 358-364): Add a zoom button overlay on the image
4. **Add Dialog** at the bottom: Full-screen image viewer dialog

**Image area change (~line 358-364):**
```tsx
<div className="rounded-lg overflow-hidden bg-muted relative group">
  {isVideo ? (
    <video ... />
  ) : (
    <>
      <img src={post.image_url} alt="Post preview" className="w-full object-contain rounded-lg" />
      <button
        onClick={() => setImageZoomOpen(true)}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
    </>
  )}
</div>
```

**Dialog at bottom of component:**
```tsx
<Dialog open={imageZoomOpen} onOpenChange={setImageZoomOpen}>
  <DialogContent className="max-w-[90vw] max-h-[90vh] p-2">
    <img src={post.image_url} className="w-full h-full object-contain" />
  </DialogContent>
</Dialog>
```

### Files Changed
- `src/components/social/PostReviewPanel.tsx`

