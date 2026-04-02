-- Ensure lead_files policies are company-scoped and authenticated-only.
DROP POLICY IF EXISTS "Anon can read lead files" ON public.lead_files;

DROP POLICY IF EXISTS "Users can view lead files in their company" ON public.lead_files;
CREATE POLICY "Users can view lead files in their company"
  ON public.lead_files FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert lead files in their company" ON public.lead_files;
CREATE POLICY "Users can insert lead files in their company"
  ON public.lead_files FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete lead files in their company" ON public.lead_files;
CREATE POLICY "Users can delete lead files in their company"
  ON public.lead_files FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
