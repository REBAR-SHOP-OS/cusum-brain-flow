CREATE TABLE public.sales_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  activity_type text NOT NULL DEFAULT 'note',
  subject text,
  body text,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  scheduled_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sales_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company activities"
  ON public.sales_lead_activities FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));