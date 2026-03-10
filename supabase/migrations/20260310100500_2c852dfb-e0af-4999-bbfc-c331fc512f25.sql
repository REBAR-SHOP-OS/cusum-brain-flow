
UPDATE machine_runs SET status = 'canceled', ended_at = now() WHERE id = '72acc77a-7134-4bf7-a0e3-4bcf35b6ce7f' AND status = 'running';

UPDATE machines 
SET current_run_id = NULL, status = 'idle', cut_session_status = 'idle', 
    machine_lock = false, active_job_id = NULL, active_plan_id = NULL, job_assigned_by = NULL
WHERE id = 'e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3';
