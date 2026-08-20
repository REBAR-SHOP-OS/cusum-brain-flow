
-- Project Management: Tasks + Milestones

CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES public.profiles(id),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC,
  actual_hours NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation
CREATE OR REPLACE FUNCTION public.validate_project_task_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('todo', 'in_progress', 'review', 'done', 'blocked') THEN
    RAISE EXCEPTION 'Invalid task status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid task priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_project_task BEFORE INSERT OR UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_project_task_fields();

CREATE OR REPLACE FUNCTION public.validate_project_milestone_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'completed', 'missed') THEN
    RAISE EXCEPTION 'Invalid milestone status: %', NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER validate_project_milestone BEFORE INSERT OR UPDATE ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.validate_project_milestone_fields();

-- Updated_at
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at BEFORE UPDATE ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages tasks" ON public.project_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office views tasks" ON public.project_tasks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Assigned user manages own tasks" ON public.project_tasks FOR ALL TO authenticated
USING (assigned_to IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admin manages milestones" ON public.project_milestones FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office views milestones" ON public.project_milestones FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

-- Audit
CREATE TRIGGER audit_project_tasks_changes AFTER UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();
