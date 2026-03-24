

## Fix Image Preview & Optimize Clearance Photos

### Problems
1. **Preview opens too big**: The fullscreen dialog (line 401) uses `max-w-[90vw] max-h-[90vh]` but the image has no max constraints, so large photos overflow the viewport.
2. **No image optimization on thumbnails**: The card thumbnails load full-resolution signed URLs without any size constraints beyond CSS `object-cover`.

### Changes

**File**: `src/components/clearance/ClearanceCard.tsx`

1. **Fix preview dialog** (line 401-405): Constrain the image inside the dialog so it fits the screen properly:
   - Change `DialogContent` to include `flex items-center justify-center` and proper overflow handling
   - Add `max-w-full max-h-[80vh] object-contain` to the `<img>` tag so the photo scales down to fit

2. **Add thumbnail optimization to PhotoSlot** (line 489): Add `loading="lazy"` and explicit dimension constraints to thumbnail images so browsers don't render them at full resolution.

3. **Reduce compression defaults**: The `compressImage` utility already handles upload compression (2048px max, 80% JPEG). This is adequate — no changes needed there.

### Files Changed

| File | Change |
|---|---|
| `src/components/clearance/ClearanceCard.tsx` | Fix preview dialog sizing + add lazy loading to thumbnails |

