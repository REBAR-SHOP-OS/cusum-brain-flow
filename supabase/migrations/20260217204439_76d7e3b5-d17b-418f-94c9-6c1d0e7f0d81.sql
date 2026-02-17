
-- Part 1: pipeline_stage_order table
CREATE TABLE public.pipeline_stage_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  stage_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id)
);

ALTER TABLE public.pipeline_stage_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can read stage order"
  ON public.pipeline_stage_order FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can insert stage order"
  ON public.pipeline_stage_order FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update stage order"
  ON public.pipeline_stage_order FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Part 2: admin-only DELETE on leads
CREATE POLICY "Only admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
