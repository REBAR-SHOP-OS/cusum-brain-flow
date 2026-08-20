
-- Table to persist applied optimization plans
CREATE TABLE public.optimization_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.extract_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  mode TEXT NOT NULL,
  stock_length_mm INTEGER NOT NULL,
  kerf_mm INTEGER NOT NULL DEFAULT 5,
  min_remnant_mm INTEGER NOT NULL DEFAULT 300,
  plan_data JSONB NOT NULL,
  total_stock_bars INTEGER,
  total_waste_kg NUMERIC,
  efficiency NUMERIC,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.optimization_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company snapshots"
  ON public.optimization_snapshots FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company snapshots"
  ON public.optimization_snapshots FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete own company snapshots"
  ON public.optimization_snapshots FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));
