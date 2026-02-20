
-- Fix ingestion_progress: replace dropped ALL policy
CREATE POLICY "Service insert ingestion progress"
  ON public.ingestion_progress FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update ingestion progress"  
  ON public.ingestion_progress FOR UPDATE
  USING (true);

-- Fix coordination log policies (dropped in failed migration attempt - need to recreate)
-- Check if they exist first via DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_coordination_log' AND policyname = 'Service role can insert coordination logs') THEN
    EXECUTE 'CREATE POLICY "Service role can insert coordination logs" ON public.project_coordination_log FOR INSERT WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_coordination_log' AND policyname = 'Service role can update coordination logs') THEN
    EXECUTE 'CREATE POLICY "Service role can update coordination logs" ON public.project_coordination_log FOR UPDATE USING (true)';
  END IF;
END $$;

-- Add company_id to estimation_learnings and fix its policies
ALTER TABLE public.estimation_learnings ADD COLUMN IF NOT EXISTS company_id UUID;

-- Add field_name if missing
ALTER TABLE public.estimation_learnings ADD COLUMN IF NOT EXISTS field_name TEXT DEFAULT 'weight_kg';
ALTER TABLE public.estimation_learnings ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.estimation_learnings ADD COLUMN IF NOT EXISTS project_id UUID;

-- Recreate estimation_learnings insert policy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'estimation_learnings' AND policyname = 'Service role can insert learnings') THEN
    EXECUTE 'CREATE POLICY "Service role can insert learnings" ON public.estimation_learnings FOR INSERT WITH CHECK (true)';
  END IF;
  -- Ensure RLS is enabled
  ALTER TABLE public.estimation_learnings ENABLE ROW LEVEL SECURITY;
  -- Ensure select policy exists
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'estimation_learnings' AND policyname LIKE '%view%' OR policyname LIKE '%select%') THEN
    EXECUTE 'CREATE POLICY "Users can view learnings" ON public.estimation_learnings FOR SELECT USING (true)';
  END IF;
END $$;
