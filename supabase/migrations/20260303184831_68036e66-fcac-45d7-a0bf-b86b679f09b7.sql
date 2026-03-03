DROP POLICY IF EXISTS "Office staff insert deliveries" ON public.deliveries;
CREATE POLICY "Staff insert deliveries" ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office','field','workshop']::app_role[])
  );