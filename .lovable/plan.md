

## Diagnosis

I confirmed the core issues from production data:

1. **`odoo_message_id` column STILL missing in production** -- the query `select odoo_message_id from lead_files` fails with `column "odoo_message_id" does not exist`. Two migration files were committed but never executed. This blocks ALL file linkage and the edge function's preflight check.

2. **File dates are wrong** -- All 7 files for this lead have `created_at = 2026-02-10` (the Odoo dump import date), NOT July 28, 2025 (the actual Odoo message date). This is why files appear under "February 9, 2026" instead of near the July 28 email. Even after linkage, the standalone file group uses `file.created_at` for its date.

3. **No tracking data** -- The 3 stage_change entries on July 28 all have `tracking_changes: null` and description "Stage Changed". The full sync (which fetches `mail.tracking.value` from Odoo) has never run because the preflight check fails (missing column).

4. **Cascade**: Because the column is missing → edge function returns 500 → full sync never completes → no file linkage → no tracking backfill → UI shows generic "Stage Changed" and files under wrong date.

## Plan

### 1. Execute the migration (for real this time)
Use the migration tool to add `odoo_message_id` to `lead_files`. This is the single blocker for everything else.

### 2. Fix file group dating in OdooChatter.tsx
When building the `file_group` thread items, if the file is Odoo-origin and unlinked, try to find a matching parent activity by `odoo_message_id` or by proximity. But more practically: for unlinked Odoo files, DON'T show them as standalone file groups at all -- they'll appear inline once the full sync links them. This prevents the wrong-date "7 files attached" block.

### 3. Edge function: backfill file dates during linkage
In `odoo-chatter-sync`, when linking `lead_files.odoo_message_id = msg.id`, also update the file's `created_at` to match the message's `date` field from Odoo. This fixes the date permanently so even standalone display uses the correct date.

### Files to change
| File | Change |
|------|--------|
| DB migration | `ALTER TABLE lead_files ADD COLUMN IF NOT EXISTS odoo_message_id integer` + index |
| `supabase/functions/odoo-chatter-sync/index.ts` | During file linkage backfill, also set `created_at` to the parent message's date |
| `src/components/pipeline/OdooChatter.tsx` | Stop pushing `unlinkedOdooFiles` into thread (they show wrong dates); they'll appear inline after sync |

After deploy: one "Sync Odoo" click will add the column, link files with correct dates, and backfill tracking data.

