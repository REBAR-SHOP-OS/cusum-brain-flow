CREATE POLICY "Workshop can insert profiles for their company"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'workshop'::app_role) OR has_role(auth.uid(), 'shop_supervisor'::app_role))
  AND company_id = get_user_company_id(auth.uid())
);