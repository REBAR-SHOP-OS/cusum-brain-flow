-- Safety-net dedup: remove duplicate leads by odoo_id (keep newest row)
-- This runs BEFORE the existing 20260304234951 migration on Production,
-- ensuring that migration's CREATE UNIQUE INDEX will succeed.

DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

-- Pre-create the index so subsequent migrations that try CREATE UNIQUE INDEX
-- (without IF NOT EXISTS) won't fail either
DROP INDEX IF EXISTS idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;