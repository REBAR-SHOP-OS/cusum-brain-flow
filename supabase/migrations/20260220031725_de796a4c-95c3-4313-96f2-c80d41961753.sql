
-- ═══════════════════════════════════════════════════
-- Learning Engine Schema: Tables + Column Additions
-- ═══════════════════════════════════════════════════

-- 1. project_coordination_log: parsed Job Log data
CREATE TABLE public.project_coordination_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  company_id UUID NOT NULL,
  project_name TEXT,
  customer_name TEXT,
  estimation_weight_kg NUMERIC DEFAULT 0,
  detailing_weight_kg NUMERIC DEFAULT 0,
  weight_difference_kg NUMERIC DEFAULT 0,
  elements JSONB DEFAULT '[]'::jsonb,
  releases JSONB DEFAULT '[]'::jsonb,
  revisions JSONB DEFAULT '[]'::jsonb,
  source_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_coordination_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company coordination logs"
  ON public.project_coordination_log FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role can insert coordination logs"
  ON public.project_coordination_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update coordination logs"
  ON public.project_coordination_log FOR UPDATE
  USING (true);

-- 2. ingestion_progress: track batch processing progress
CREATE TABLE public.ingestion_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'barlists', 'job_logs', 'learning_pairs'
  company_id UUID NOT NULL,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  last_processed_lead_id UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  error_log JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ingestion progress"
  ON public.ingestion_progress FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Service role can manage ingestion progress"
  ON public.ingestion_progress FOR ALL
  USING (true);

-- 3. Add lead_id to barlists
ALTER TABLE public.barlists
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- 4. Extend estimation_learnings (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estimation_learnings') THEN
    CREATE TABLE public.estimation_learnings (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id UUID NOT NULL,
      project_id UUID,
      lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
      element_type TEXT,
      bar_size TEXT,
      mark TEXT,
      field_name TEXT NOT NULL,
      original_value TEXT,
      corrected_value TEXT,
      weight_delta_pct NUMERIC,
      context JSONB DEFAULT '{}'::jsonb,
      confidence_score NUMERIC DEFAULT 0,
      source TEXT DEFAULT 'manual', -- manual, auto_validation, ingestion
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.estimation_learnings ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own company learnings"
      ON public.estimation_learnings FOR SELECT
      USING (company_id = public.get_user_company_id(auth.uid()));

    CREATE POLICY "Service role can insert learnings"
      ON public.estimation_learnings FOR INSERT
      WITH CHECK (true);
  ELSE
    -- Add columns if table already exists
    ALTER TABLE public.estimation_learnings
      ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS bar_size TEXT,
      ADD COLUMN IF NOT EXISTS mark TEXT,
      ADD COLUMN IF NOT EXISTS weight_delta_pct NUMERIC;
  END IF;
END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coordination_log_lead ON public.project_coordination_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_coordination_log_company ON public.project_coordination_log(company_id);
CREATE INDEX IF NOT EXISTS idx_barlists_lead ON public.barlists(lead_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_progress_job ON public.ingestion_progress(job_type, status);
CREATE INDEX IF NOT EXISTS idx_estimation_learnings_element ON public.estimation_learnings(element_type, bar_size);
