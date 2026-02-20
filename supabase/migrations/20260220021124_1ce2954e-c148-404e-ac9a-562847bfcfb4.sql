
-- ============================================================
-- Estimation Projects
-- ============================================================
CREATE TABLE public.estimation_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  status TEXT NOT NULL DEFAULT 'draft',
  source_files JSONB DEFAULT '[]'::jsonb,
  element_summary JSONB DEFAULT '{}'::jsonb,
  total_weight_kg NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  waste_factor_pct NUMERIC DEFAULT 5,
  labor_hours NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estimation_projects ENABLE ROW LEVEL SECURITY;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_estimation_project_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'in_progress', 'completed', 'approved') THEN
    RAISE EXCEPTION 'Invalid estimation project status: %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_estimation_project_status
  BEFORE INSERT OR UPDATE ON public.estimation_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_estimation_project_status();

-- RLS policies
CREATE POLICY "Users can view own company estimation projects"
  ON public.estimation_projects FOR SELECT
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can insert estimation projects for own company"
  ON public.estimation_projects FOR INSERT
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can update own company estimation projects"
  ON public.estimation_projects FOR UPDATE
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete own company estimation projects"
  ON public.estimation_projects FOR DELETE
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- ============================================================
-- Estimation Items
-- ============================================================
CREATE TABLE public.estimation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.estimation_projects(id) ON DELETE CASCADE,
  element_type TEXT,
  element_ref TEXT,
  mark TEXT,
  bar_size TEXT,
  grade TEXT DEFAULT '400W',
  shape_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  cut_length_mm NUMERIC,
  total_length_mm NUMERIC,
  hook_allowance_mm NUMERIC DEFAULT 0,
  lap_allowance_mm NUMERIC DEFAULT 0,
  weight_kg NUMERIC DEFAULT 0,
  spacing_mm NUMERIC,
  dimensions JSONB,
  unit_cost NUMERIC DEFAULT 0,
  line_cost NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'ai_extracted',
  warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estimation_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estimation_items_project ON public.estimation_items(project_id);

-- RLS via parent project
CREATE POLICY "Users can view estimation items via project"
  ON public.estimation_items FOR SELECT
  USING (project_id IN (
    SELECT ep.id FROM public.estimation_projects ep
    WHERE ep.company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

CREATE POLICY "Users can insert estimation items via project"
  ON public.estimation_items FOR INSERT
  WITH CHECK (project_id IN (
    SELECT ep.id FROM public.estimation_projects ep
    WHERE ep.company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

CREATE POLICY "Users can update estimation items via project"
  ON public.estimation_items FOR UPDATE
  USING (project_id IN (
    SELECT ep.id FROM public.estimation_projects ep
    WHERE ep.company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

CREATE POLICY "Users can delete estimation items via project"
  ON public.estimation_items FOR DELETE
  USING (project_id IN (
    SELECT ep.id FROM public.estimation_projects ep
    WHERE ep.company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  ));

-- ============================================================
-- Estimation Pricing
-- ============================================================
CREATE TABLE public.estimation_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  bar_size TEXT NOT NULL,
  material_cost_per_kg NUMERIC NOT NULL DEFAULT 0,
  labor_rate_per_hour NUMERIC NOT NULL DEFAULT 0,
  kg_per_labor_hour NUMERIC NOT NULL DEFAULT 50,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estimation_pricing ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estimation_pricing_company ON public.estimation_pricing(company_id, is_active);

CREATE POLICY "Users can view own company pricing"
  ON public.estimation_pricing FOR SELECT
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can insert own company pricing"
  ON public.estimation_pricing FOR INSERT
  WITH CHECK (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can update own company pricing"
  ON public.estimation_pricing FOR UPDATE
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete own company pricing"
  ON public.estimation_pricing FOR DELETE
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));
