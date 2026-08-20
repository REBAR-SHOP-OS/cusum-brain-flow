
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS active_job_id uuid;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS cut_session_status text DEFAULT 'idle';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS job_assigned_by text DEFAULT 'optimizer';
