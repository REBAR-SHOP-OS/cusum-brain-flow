
-- Multi-assignee junction table for leads (main pipeline)
CREATE TABLE public.lead_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, profile_id)
);
ALTER TABLE public.lead_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage lead assignees"
  ON public.lead_assignees FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Multi-assignee junction table for sales_leads
CREATE TABLE public.sales_lead_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sales_lead_id, profile_id)
);
ALTER TABLE public.sales_lead_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can manage sales lead assignees"
  ON public.sales_lead_assignees FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
