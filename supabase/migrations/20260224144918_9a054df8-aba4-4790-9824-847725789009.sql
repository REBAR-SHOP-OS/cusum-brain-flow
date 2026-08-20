
DROP POLICY IF EXISTS "Admins can read all contacts" ON public.contacts;
CREATE POLICY "Admins can read all contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id(auth.uid()));
