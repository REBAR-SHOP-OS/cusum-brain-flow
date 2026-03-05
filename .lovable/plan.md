

# Clean File & Image Display in Chatter Feed

## Problem

The feed shows each file as a separate "File attached" entry, creating visual clutter. The 5-second dedup filter also removes files that should be visible. Images from Odoo need inline previews like the Odoo screenshot shows.

## Changes — `src/components/pipeline/OdooChatter.tsx`

### 1. Remove aggressive dedup filter
The current 5s proximity filter hides legitimate files. Remove it — show ALL files from `lead_files`, grouped by time proximity.

### 2. Increase grouping window from 30s to 120s
Files uploaded in the same batch (within 2 minutes) get grouped into one "Files attached" card with a grid of thumbnails, not separate entries.

### 3. Improve `FileGroupThreadItem` layout
- Show image thumbnails in a 2-3 column grid inside the card
- Show non-image files as compact chips below the grid
- Single "File attached" header per group

### 4. Improve `FileThreadItem` for single files
- If it's an image, show inline preview thumbnail directly
- If it's a non-image, show the file chip only
- Add storage-path image support (not just Odoo images)

### 5. Add signed URL support for storage-path images
Currently only Odoo images get previews. Files uploaded via chatter (with `storage_path`) should also render inline image previews using signed URLs.

| Area | Detail |
|------|--------|
| Dedup | Remove 5s activity proximity filter, keep all files |
| Grouping | 120s window, combine into single card |
| Image preview | Grid layout for grouped images, inline for singles |
| Storage images | Signed URL preview for locally uploaded images |
| File | `src/components/pipeline/OdooChatter.tsx` |

