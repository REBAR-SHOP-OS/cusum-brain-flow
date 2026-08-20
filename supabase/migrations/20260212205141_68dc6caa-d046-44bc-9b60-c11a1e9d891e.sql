
-- Create call_tasks table
CREATE TABLE public.call_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  agent_id UUID REFERENCES public.agents(id),
  user_id UUID,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  lead_id UUID REFERENCES public.leads(id),
  contact_id UUID REFERENCES public.contacts(id),
  status TEXT NOT NULL DEFAULT 'queued',
  outcome TEXT,
  rc_session_id TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  ai_transcript JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: prevent duplicate active calls to same phone
CREATE UNIQUE INDEX idx_call_tasks_active_phone
  ON public.call_tasks (phone)
  WHERE status IN ('queued', 'dialing', 'in_call');

-- Validation trigger for status and outcome
CREATE OR REPLACE FUNCTION public.validate_call_task_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('queued', 'dialing', 'in_call', 'done', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid call_task status: %', NEW.status;
  END IF;
  IF NEW.outcome IS NOT NULL AND NEW.outcome NOT IN ('answered', 'no_answer', 'voicemail', 'wrong_number', 'busy') THEN
    RAISE EXCEPTION 'Invalid call_task outcome: %', NEW.outcome;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_call_task
  BEFORE INSERT OR UPDATE ON public.call_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_call_task_fields();

-- Updated_at trigger
CREATE TRIGGER update_call_tasks_updated_at
  BEFORE UPDATE ON public.call_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.call_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users see own company call tasks"
  ON public.call_tasks FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users create call tasks in own company"
  ON public.call_tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update own company call tasks"
  ON public.call_tasks FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can delete call tasks"
  ON public.call_tasks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for call_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_tasks;
