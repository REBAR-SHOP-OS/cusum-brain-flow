

# Move Video Buttons Below Image Buttons

## What
Split the 4 action buttons into two rows:
- **Row 1**: "Regenerate image" + "AI Image"
- **Row 2**: "Generate video" + "Upload Video"

## How

### File: `src/components/social/PostReviewPanel.tsx` (lines 379-434)

Wrap the current single `flex gap-2` div into two stacked rows using `flex flex-col gap-2`, each row being `flex gap-2`:

```tsx
<div className="flex flex-col gap-2">
  {/* Row 1: Image actions */}
  <div className="flex gap-2">
    <Button ...>Regenerate image</Button>
    <Button ...>AI Image</Button>
  </div>
  {/* Row 2: Video actions */}
  <div className="flex gap-2">
    <Button ...>Generate video</Button>
    <label>...<Button ...>Upload Video</Button></label>
  </div>
</div>
```

No logic changes — just layout restructuring.

