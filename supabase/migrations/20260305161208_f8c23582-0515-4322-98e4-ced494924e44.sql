-- Dedup leads by odoo_id on Live: keep newest row per odoo_id, delete older duplicates
DELETE FROM leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY metadata->>'odoo_id'
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) sub
  WHERE rn > 1
);
