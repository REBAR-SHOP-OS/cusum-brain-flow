

# Move "Upload Image" Button Below "Edit Image"

## Change

**`src/components/social/PostReviewPanel.tsx`** (lines 454-486):

Move the `Upload Image` label/button from the first `flex gap-2` row (alongside Upload Video) down to the second `flex gap-2` row (alongside Edit Image and Auto Generate Story).

Current layout:
```
Row 1: [AI Generate image] [AI Image]
Row 2: [AI Generate video] [Upload Video] [Upload Image]  ← remove from here
Row 3: [Edit Image] [Auto Generate Story]
```

New layout:
```
Row 1: [AI Generate image] [AI Image]
Row 2: [AI Generate video] [Upload Video]
Row 3: [Upload Image] [Edit Image] [Auto Generate Story]  ← moved here
```

