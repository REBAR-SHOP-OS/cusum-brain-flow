
-- Step 1: Dedup leads by odoo_id (keep the row with the largest id)
DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

-- Step 2: Drop index if it exists (may have been partially created)
DROP INDEX IF EXISTS idx_leads_odoo_id_unique;

-- Step 3: Recreate the unique index
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;
