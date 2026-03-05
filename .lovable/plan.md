

# Fix Chatter Feed — Match Odoo Exactly

## Root Cause Found

All files have `created_at = 2026-02-10 04:46:27` (the sync timestamp), NOT their original Odoo timestamp. The 10-minute matching window matches them to the wrong activity. There's no `odoo_message_id` column on `lead_files` to directly link files to their parent message. **Timestamp-based matching is fundamentally broken for synced data.**

## Issues to Fix

1. **Files matched to wrong activities** — Timestamp matching attaches files to whatever activity is closest to the sync time, not the actual parent message
2. **"Stage Changed / Stage Changed" duplicate text** — Title says "Stage Changed", description also says "Stage Changed". In Odoo, stage changes show tracking bullets only (`• Stage: Old → New`)
3. **Orphan files pinned at top** — Files should appear in chronological order within the feed, not forced to the top
4. **forwardRef console warning** — `ActivityThreadItem` still triggers ref warning

## Plan — `src/components/pipeline/OdooChatter.tsx`

### A. Remove timestamp-based file matching
Delete the entire `MATCH_WINDOW` / `activityFilesMap` matching logic. Files and activities are independent data sources — stop trying to merge them.

### B. Show files as chronological standalone entries
Insert each file (or 60s batch) into the thread sorted by `created_at` alongside activities and communications. No more `orphan_files` special kind — just `file_group` entries sorted normally.

### C. Fix stage change display
In `ActivityThreadItem`, when `tracking_changes` exist (from metadata), suppress the duplicate "Stage Changed" title and description text. Only show the tracking bullets. When no tracking_changes, show the current title/description as fallback.

### D. Fix forwardRef
The `React.memo` wrapper is already there but something is passing a ref. Wrap with `React.forwardRef` inside the memo.

| File | Changes |
|------|---------|
| `OdooChatter.tsx` | Remove timestamp matching, chronological file entries, fix stage change text, fix forwardRef |

