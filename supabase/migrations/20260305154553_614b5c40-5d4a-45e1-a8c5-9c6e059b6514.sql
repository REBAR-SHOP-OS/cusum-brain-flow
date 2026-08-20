
-- Dedup leads by odoo_id (keep newest), then recreate unique index
DELETE FROM leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY metadata->>'odoo_id' ORDER BY created_at DESC, id DESC) AS rn
    FROM leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) sub
  WHERE rn > 1
);

DROP INDEX IF EXISTS idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;
