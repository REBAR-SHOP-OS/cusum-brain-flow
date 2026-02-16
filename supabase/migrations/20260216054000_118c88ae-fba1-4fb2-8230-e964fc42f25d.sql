
-- Add performance indexes on autopilot tables
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_run_id ON public.autopilot_actions (run_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_actions_status ON public.autopilot_actions (status);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_status ON public.autopilot_runs (status);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_company_status ON public.autopilot_runs (company_id, status);
