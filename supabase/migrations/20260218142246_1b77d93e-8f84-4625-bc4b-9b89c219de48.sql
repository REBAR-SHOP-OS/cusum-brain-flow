
-- Create project_events table for activity timeline
CREATE TABLE public.project_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'System',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing get_user_company_id function
CREATE POLICY "Users can view their company project events"
  ON public.project_events FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their company project events"
  ON public.project_events FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_project_events_project ON public.project_events(project_id, created_at DESC);
CREATE INDEX idx_project_events_company ON public.project_events(company_id, created_at DESC);

-- Trigger: auto-log task changes to project_events
CREATE OR REPLACE FUNCTION public.log_project_task_event()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _project_name TEXT;
  _user_name TEXT;
BEGIN
  -- Get project name safely
  IF NEW.project_id IS NOT NULL THEN
    SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  END IF;

  -- Get user name from profiles
  IF auth.uid() IS NOT NULL THEN
    SELECT full_name INTO _user_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  _user_name := COALESCE(_user_name, 'System');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_events (company_id, project_id, event_type, title, description, created_by, metadata)
    VALUES (
      NEW.company_id,
      NEW.project_id,
      'task_created',
      'Task created: ' || NEW.title,
      NULL,
      _user_name,
      jsonb_build_object('task_id', NEW.id, 'priority', NEW.priority, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.project_events (company_id, project_id, event_type, title, description, created_by, metadata)
      VALUES (
        NEW.company_id,
        NEW.project_id,
        CASE WHEN NEW.status = 'done' THEN 'task_completed' ELSE 'status_changed' END,
        CASE WHEN NEW.status = 'done' THEN 'Task completed: ' || NEW.title
             ELSE 'Task status changed: ' || NEW.title END,
        OLD.status || ' → ' || NEW.status,
        _user_name,
        jsonb_build_object('task_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_project_task_event
  AFTER INSERT OR UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_task_event();
