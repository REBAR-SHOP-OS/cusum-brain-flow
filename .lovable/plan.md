

# Audit & Fix: Chatter Feed vs Odoo

## Issues Found

After reviewing the code, console logs, and comparing with Odoo's behavior:

### 1. Root container still uses `space-y-0` (line 339)
The main wrapper is `<div className="space-y-0">` — items are cramped together with no breathing room between sections.

### 2. Orphan files rendered as a single blob at top
All unmatched files are crammed into one `FileGroupThreadItem` at the top. In Odoo, each file attachment event is a separate, clean card with the uploader's name, timestamp, and inline preview.

### 3. Files with `odoo_id` that also lack `storage_path` may not render previews
The `InlineFileAttachments` component checks `!file.storage_path && file.odoo_id` for Odoo files — but files that have neither `storage_path` nor `odoo_id` get no preview at all (just a chip).

### 4. Matching window may miss files
The 5-minute window works for synced data, but locally uploaded files via chatter may have timestamps that don't align with any activity. These become orphans instead of showing as their own "File attached" activity card.

### 5. Console warning: `Function components cannot be given refs`
`ActivityThreadItem` is being passed a ref somewhere — needs `forwardRef` or ref removal.

### 6. No download button on file chips
Odoo shows a clear download action on each file. Current chips open in new tab but lack visual download affordance.

## Plan

### `src/components/pipeline/OdooChatter.tsx`

**A. Fix spacing** — Change root `space-y-0` to `space-y-2` for visual separation between composer, planned activities, and thread.

**B. Split orphan files into individual cards** — Instead of one `FileGroupThreadItem` for all orphans, render each orphan file (or time-grouped batch within 60s) as its own thread entry with avatar, timestamp, and inline preview. This matches Odoo where each "file attached" event is a separate card.

**C. Increase matching window to 10 minutes** — Some Odoo-synced files have timestamps that drift from their parent message. Widen from 5min to 10min.

**D. Add download icon to file chips** — Add a small `Download` icon to non-image file buttons for clearer affordance.

**E. Show file preview for files without odoo_id or storage_path** — If a file has a `file_url`, render it as a clickable link/thumbnail. Currently these files show nothing.

**F. Fix forwardRef warning** — Not critical but clean up the console warning.

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Fix spacing, split orphan files into individual cards, widen matching window, add download icons, handle file_url previews |

