
-- Add created_by_profile_id to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by_profile_id UUID REFERENCES public.profiles(id);

-- Create task_audit_log table
CREATE TABLE public.task_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  actor_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read audit logs for tasks in their company
CREATE POLICY "Authenticated users can read task audit logs"
ON public.task_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_audit_log.task_id
      AND t.company_id = public.get_user_company_id(auth.uid())
  )
);

-- RLS: authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert task audit logs"
ON public.task_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_audit_log.task_id
      AND t.company_id = public.get_user_company_id(auth.uid())
  )
);

-- Index for fast lookups by task_id
CREATE INDEX idx_task_audit_log_task_id ON public.task_audit_log(task_id);
