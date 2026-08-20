-- Fix 1: Dedup leads by odoo_id then create unique index
-- (The original migration failed because duplicates existed)
DELETE FROM leads a USING leads b
WHERE a.id < b.id
  AND a.metadata->>'odoo_id' IS NOT NULL
  AND a.metadata->>'odoo_id' = b.metadata->>'odoo_id';

DROP INDEX IF EXISTS idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;

-- Fix 2: Add workshop role to delivery_stops INSERT policy
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON delivery_stops;
CREATE POLICY "Staff insert delivery_stops" ON delivery_stops
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );