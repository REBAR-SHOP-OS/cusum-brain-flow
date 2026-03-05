-- Deduplicate leads by odoo_id (keep newest row) so that the unique index migration can succeed
DELETE FROM leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY metadata->>'odoo_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM leads WHERE metadata->>'odoo_id' IS NOT NULL
  ) sub WHERE rn > 1
);

-- Neutralize redundant fix migrations by making them no-ops
-- These will be handled by converting the files to SELECT 1