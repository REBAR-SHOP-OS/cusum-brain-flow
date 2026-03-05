

# Fix: Column Missing + Full Sync + UI Cleanup

## Root Cause (Confirmed)
The `odoo_message_id` column exists in **development** but **NOT in production**. Three migration SQL files were committed but never executed against the production database. This is why:
- All 15,745 Odoo files remain unlinked (0 linked)
- Files show as a detached "7 files attached" block instead of inline under messages
- Stage changes show "Stage Changed" with `has_tracking: true` but no `tracking_changes` data

## Changes

### 1. Execute migration against production (via migration tool)
```sql
ALTER TABLE public.lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer;
CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_message_id ON public.lead_files(odoo_message_id);
```
This time use the migration tool to ensure it actually runs, not just creates a file.

### 2. Change Sync Odoo to always run full chatter sync
In `src/pages/Pipeline.tsx` line 611, change `mode: "missing"` to `mode: "full"` so every sync repairs file linkages and backfills tracking data.

### 3. UI: Hide standalone Odoo file groups entirely
In `OdooChatter.tsx`, stop pushing `unlinkedOdooFiles` into the thread as standalone `file_group` items. These files will appear inline once the sync backfills `odoo_message_id`. Showing them as a detached block is worse than not showing them (it's the "7 files attached" card the user sees).

| File | Change |
|------|--------|
| DB migration | Add `odoo_message_id` column to production |
| `src/pages/Pipeline.tsx` | Line 611: `"missing"` → `"full"` |
| `src/components/pipeline/OdooChatter.tsx` | Remove `unlinkedOdooFiles` from thread items |

After deployment, one "Sync Odoo" click will backfill all file linkages and tracking data.

