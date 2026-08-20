
CREATE TABLE IF NOT EXISTS public.loading_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_plan_id uuid REFERENCES public.cut_plans(id),
  project_name text,
  company_id uuid,
  photo_url text NOT NULL,
  notes text,
  captured_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.loading_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view loading evidence for their company"
  ON public.loading_evidence FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert loading evidence for their company"
  ON public.loading_evidence FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
