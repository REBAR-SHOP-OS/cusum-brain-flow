

# Show Files Inline in Chatter Feed — Odoo Style

## Problem

Files exist in the chatter thread but are buried at the bottom (sorted by date), and they show as a separate "files attached" group disconnected from the messages that uploaded them. In Odoo, files appear as inline attachments within the specific message/activity that uploaded them — not as standalone entries.

Currently files with `created_at` of Feb 10 sink below all stage changes from Feb 17+, making them invisible unless the user scrolls to the very bottom.

## Solution

### 1. Attach files to their parent activity instead of showing separately

Instead of putting files into the thread as standalone `FileGroupThreadItem` entries, match files to their closest activity by timestamp proximity (within 5 minutes) and render them inline below that activity's content. This matches Odoo's behavior where attachments appear under the message that uploaded them.

- In `ActivityThreadItem`, accept a `files` prop and render attached files (image thumbnails + file chips) below the activity body
- Remove standalone `FileGroup` and `FileThreadItem` from the main thread
- Files that don't match any activity still appear as standalone entries (fallback)

### 2. Show unmatched files at the top of the feed

Any files that don't match an activity should appear at the top of the thread (not buried at the bottom) so users always see them.

### 3. Clean layout for inline file attachments

Within each activity that has files:
- Image files: show as a thumbnail grid (2-3 cols, 64px thumbnails)
- Non-image files: show as compact download chips
- Use `OdooImagePreview` for Odoo files, `StorageImagePreview` for storage files

| File | Change |
|------|--------|
| `src/components/pipeline/OdooChatter.tsx` | Match files to activities by timestamp, render inline, show orphan files at top |

