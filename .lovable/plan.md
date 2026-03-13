

# Move "Auto Generate Story" Below Upload Image

## Change
In `src/components/social/PostReviewPanel.tsx`, lines 455-486:

Move the "Auto Generate Story" button out of the same `flex` row as "Upload Image" / "Edit Image" and place it in its own row below.

### Current layout (line 455-486):
```
<div className="flex gap-2">        ← single row
  [Upload Image]  [Edit Image]  [Auto Generate Story]
</div>
```

### New layout:
```
<div className="flex gap-2 flex-wrap">   ← row 1
  [Upload Image]  [Edit Image]
</div>
<div>                                    ← row 2
  [Auto Generate Story]
</div>
```

### Exact code change (lines 455-486):
Replace the single `<div className="flex gap-2">` block with two separate blocks:
1. First block: `flex gap-2 flex-wrap` containing Upload Image label and Edit Image button
2. Second block: standalone div containing only the Auto Generate Story button

One file changed: `src/components/social/PostReviewPanel.tsx`

