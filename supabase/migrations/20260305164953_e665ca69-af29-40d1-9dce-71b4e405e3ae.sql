-- Fix delivery_stops UPDATE policy to include workshop role
DROP POLICY IF EXISTS "Office staff update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Staff update delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff update delivery_stops"
ON public.delivery_stops
FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::public.app_role[])
);