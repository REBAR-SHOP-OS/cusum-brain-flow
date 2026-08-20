UPDATE public.machine_runs
SET status = 'completed', ended_at = now()
WHERE id = '14b23617-6ac9-4f7c-a764-b95332569768' AND status = 'running';

UPDATE public.machines
SET current_run_id = NULL,
    status = 'idle',
    cut_session_status = 'idle',
    machine_lock = false,
    active_job_id = NULL,
    last_event_at = now()
WHERE id = 'e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3';