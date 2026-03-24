
DROP POLICY IF EXISTS "Users can manage own company activities" ON public.sales_lead_activities;

CREATE POLICY "Users can manage own company activities"
  ON public.sales_lead_activities FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid()));
