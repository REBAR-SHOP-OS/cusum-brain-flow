

## Odoo Sync Mismatch Analysis

### Current State
- **Odoo**: 2903 opportunities
- **ERP**: 2920 `odoo_sync` leads (2913 unique odoo_ids + 7 orphans with NULL odoo_id)
- **Gap**: 10 extra leads in ERP that no longer exist in Odoo, plus 7 orphan records

### Root Cause
The sync fetches all 2903 leads successfully — no errors. The mismatch comes from:

1. **7 orphan leads** with `NULL` odoo_id (already `archived_orphan` stage) — these were imported from a legacy dump without proper odoo_id mapping
2. **10 stale leads** — odoo_ids that exist in ERP but were deleted/merged in Odoo since the last full sync. The reconciliation logic (line 615-632) should archive these during a `full` sync, but only moves them to `lost` stage — it doesn't delete them, so the count stays higher

### Fix Plan

**1. Clean orphan leads (data fix)**
Delete or permanently archive the 7 leads with NULL odoo_id — they have no Odoo counterpart and corrupt the count.

**2. Force a full sync to trigger reconciliation**
The reconciliation code at line 615 already handles stale leads during `mode === "full"` — it marks them as `lost`. We need to ensure this runs and the 10 extra leads get archived properly.

**3. Fix count display logic**
Update the Pipeline UI to exclude `archived_orphan` and orphan records from the displayed lead count, so it matches Odoo's active opportunity count exactly.

### File Changes

**`supabase/functions/odoo-crm-sync/index.ts`**
- In the reconciliation block (line 615-639): also archive leads with NULL odoo_id as `archived_orphan`
- After the main sync loop, add a cleanup step that marks any `odoo_sync` lead with NULL `metadata->odoo_id` as `archived_orphan`

**Pipeline UI (count display)**
- Ensure the pipeline lead count query excludes `archived_orphan` stage leads to match Odoo's number exactly

**Data cleanup (one-time)**
- Mark the 7 NULL-odoo_id orphan leads as `archived_orphan` (they already are — just ensure they're excluded from counts)
- Trigger a full sync to reconcile the 10 stale leads

