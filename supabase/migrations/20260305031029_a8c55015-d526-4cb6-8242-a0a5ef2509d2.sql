-- Step 1: Delete duplicate leads keeping only the most recently synced per odoo_id
DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

-- Step 2: Drop the index if it partially exists, then recreate
DROP INDEX IF EXISTS idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;