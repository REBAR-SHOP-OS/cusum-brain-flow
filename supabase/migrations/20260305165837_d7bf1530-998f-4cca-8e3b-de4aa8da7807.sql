-- Emergency dedup: remove duplicate leads by odoo_id (keep newest)
-- This unblocks the stuck migration 20260304234951
DELETE FROM public.leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY metadata->>'odoo_id'
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM public.leads
    WHERE metadata->>'odoo_id' IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Idempotent index creation (in case 20260304234951 already applied partially)
DROP INDEX IF EXISTS public.idx_leads_odoo_id_unique;
CREATE UNIQUE INDEX idx_leads_odoo_id_unique
  ON public.leads ((metadata->>'odoo_id'))
  WHERE metadata->>'odoo_id' IS NOT NULL;

-- Fix delivery_stops INSERT policy (add workshop role)
DROP POLICY IF EXISTS "Office staff insert delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff insert delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff insert delivery_stops"
ON public.delivery_stops
FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);

-- Fix delivery_stops UPDATE policy (add workshop role)
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff update delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff update delivery_stops"
ON public.delivery_stops
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);