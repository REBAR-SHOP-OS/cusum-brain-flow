ALTER TABLE public.seo_tasks
  ADD COLUMN IF NOT EXISTS execution_log jsonb,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS executed_by text;