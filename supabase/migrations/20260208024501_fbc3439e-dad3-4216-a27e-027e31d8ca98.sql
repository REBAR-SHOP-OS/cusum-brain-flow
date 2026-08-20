
-- Remove the NULL company_id loophole from contacts policies
DROP POLICY IF EXISTS "Sales and accounting can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can delete contacts" ON public.contacts;

CREATE POLICY "Sales and accounting can read contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Sales and accounting can insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Sales and accounting can update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND company_id = public.get_user_company_id(auth.uid())
);
