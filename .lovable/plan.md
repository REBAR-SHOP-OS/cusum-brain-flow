

# Fix: Migration `20260304234951` Blocking Publish

## Root Cause
The migration file `20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql` only contains:
```sql
CREATE UNIQUE INDEX idx_leads_odoo_id_unique ON leads ((metadata->>'odoo_id')) WHERE metadata->>'odoo_id' IS NOT NULL;
```
Live has duplicate `odoo_id` values (e.g. key `3083`), so this fails every publish. The dedup was run on Test but **never embedded in the migration file itself** -- which is what actually runs on Live during publish.

## Fix
Rewrite the migration file to:
1. Delete duplicate leads by `odoo_id` (keeping newest)
2. Drop index if it already exists (for Test where it already ran)
3. Create the unique index

This is the **only** change needed. The migration runs on Live during publish, deduplicates first, then creates the index successfully.

### File: `supabase/migrations/20260304234951_f3b11fd1-92a6-4b57-a45e-2967837649e5.sql`
```sql
-- Deduplicate leads by odoo_id before creating unique index
DELETE FROM leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM leads WHERE metadata->>'odoo_id' IS NOT NULL
  ) sub WHERE rn > 1
);

-- Safety: drop if already exists (e.g. on Test)
DROP INDEX IF EXISTS idx_leads_odoo_id_unique;

-- Create the unique index
CREATE UNIQUE INDEX idx_leads_odoo_id_unique ON leads ((metadata->>'odoo_id')) WHERE metadata->>'odoo_id' IS NOT NULL;
```

After this edit, Publish will succeed and the `delivery_stops` policy fixes (from the later migration `20260305163106`) will also apply to Live.

