
-- Cancel any orphaned running runs (runs with status='running' but not linked as current_run_id on any machine)
UPDATE public.machine_runs mr
SET status = 'canceled', ended_at = now(), notes = 'Migration: orphaned running run cleanup'
WHERE mr.status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM public.machines m WHERE m.current_run_id = mr.id
  );

-- For machines that have current_run_id pointing to non-running runs, clear them
UPDATE public.machines m
SET current_run_id = NULL, active_job_id = NULL, active_plan_id = NULL,
    cut_session_status = 'idle', machine_lock = false, job_assigned_by = NULL,
    status = 'idle', last_event_at = now()
WHERE m.current_run_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.machine_runs mr WHERE mr.id = m.current_run_id AND mr.status = 'running'
  );

-- Ensure only one running run per machine going forward
CREATE UNIQUE INDEX IF NOT EXISTS unique_running_machine_run
ON public.machine_runs (machine_id)
WHERE status = 'running';
