
## Fix: Odoo File Migration Stuck on Bad Attachment IDs

### The Problem

The `archive-odoo-files` function migrates files from Odoo into your storage. It processes files in order from the `lead_files` table. The queue is stuck because the **first files in the batch keep returning "Attachment not found or empty"** from Odoo — so every run hits those same bad records and never advances past them.

Currently: 15,260 files pending. 0 progress for the last 7 days.

### Root Cause

The function selects `LIMIT 5` files with `storage_path IS NULL` — always in the same order. When Odoo returns empty data for those IDs (deleted/inaccessible attachments), the function marks them as `failed` but **does not mark them in the database**. So next run picks the same 5 bad files again, forever.

### Fix Plan

**Step 1 — Mark permanently-failed files so they are skipped**

Add a `migration_failed` boolean column (default `false`) to `lead_files`. When the Odoo API returns "not found or empty" for an attachment, set `migration_failed = true` on that row. The query then adds `.eq("migration_failed", false)` so those dead IDs are skipped permanently.

**Step 2 — Skip bad IDs, advance the queue**

Update the `archive-odoo-files` edge function to:
- On "not found or empty" error → update `lead_files` row: `migration_failed = true`, `migration_error = <message>`
- On upload error → same: mark failed, skip
- Query filter: `storage_path IS NULL AND migration_failed = false`

**Step 3 — Add a retry cap**

Add `migration_attempts` integer column. Increment on each attempt. If `migration_attempts >= 3` AND still failing, mark `migration_failed = true`. This handles transient Odoo timeouts vs. truly missing files.

**Step 4 — Surface the health status in the UI**

Add a small status indicator on the Integrations page (or Accounting page) showing:
- Files migrated / total
- Files permanently failed (so you can investigate those in Odoo)
- A "Retry Failed" button to reset `migration_failed = false` on demand

### Database Changes

```sql
ALTER TABLE lead_files 
  ADD COLUMN migration_failed BOOLEAN DEFAULT FALSE,
  ADD COLUMN migration_attempts INTEGER DEFAULT 0,
  ADD COLUMN migration_error TEXT;
```

### Files to Modify

| File | Change |
|---|---|
| `supabase/functions/archive-odoo-files/index.ts` | Add failed-marking logic, skip bad IDs, increment attempts |

### Files to Create

None — this is a targeted fix to the existing function.

### Expected Outcome

- The queue advances past the ~100 bad Odoo attachment IDs
- The remaining ~15,000 valid files start migrating at 5 per run
- Bad IDs are recorded so they can be investigated or bulk-cleared in Odoo
- Inbound sync remains unaffected (it's already healthy)
