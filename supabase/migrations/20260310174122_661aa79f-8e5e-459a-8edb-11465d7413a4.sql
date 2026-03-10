
UPDATE machine_runs 
SET status = 'canceled', ended_at = now() 
WHERE id = '6d7f446d-bf7e-4df0-9e4b-f8afb4813fcf' AND status = 'running';

UPDATE machines 
SET current_run_id = NULL, 
    active_job_id = NULL, 
    active_plan_id = NULL, 
    machine_lock = false, 
    cut_session_status = 'idle', 
    status = 'idle',
    last_event_at = now()
WHERE id = 'e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3';
