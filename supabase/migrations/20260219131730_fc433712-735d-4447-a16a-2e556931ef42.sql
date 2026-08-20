
ALTER TABLE public.accounting_mirror_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped select" ON public.accounting_mirror_customers
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company-scoped insert" ON public.accounting_mirror_customers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Company-scoped update" ON public.accounting_mirror_customers
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin delete only" ON public.accounting_mirror_customers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
