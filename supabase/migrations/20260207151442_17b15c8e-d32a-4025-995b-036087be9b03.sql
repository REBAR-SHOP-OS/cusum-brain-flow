
-- =============================================================
-- MULTI-PROJECT PRODUCTION: production_tasks + machine_queue_items
-- =============================================================

-- 1) production_tasks — the central unit of work
CREATE TABLE public.production_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  project_id UUID REFERENCES public.work_orders(id),
  work_order_id UUID REFERENCES public.work_orders(id),
  cut_plan_id UUID REFERENCES public.cut_plans(id),
  cut_plan_item_id UUID REFERENCES public.cut_plan_items(id),
  task_type TEXT NOT NULL DEFAULT 'cut' CHECK (task_type IN ('cut','bend','spiral','load','other')),
  bar_code TEXT NOT NULL REFERENCES public.rebar_sizes(bar_code),
  grade TEXT DEFAULT 'GR60',
  setup_key TEXT GENERATED ALWAYS AS (task_type || ':' || bar_code || ':' || COALESCE(grade, 'GR60')) STORED,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','running','done','canceled','blocked')),
  locked_to_machine_id UUID REFERENCES public.machines(id),
  qty_required INTEGER NOT NULL DEFAULT 1,
  qty_completed INTEGER NOT NULL DEFAULT 0,
  mark_number TEXT,
  drawing_ref TEXT,
  cut_length_mm INTEGER,
  asa_shape_code TEXT,
  bend_dimensions JSONB,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their company" ON public.production_tasks
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can manage tasks" ON public.production_tasks
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- Indexes
CREATE INDEX idx_production_tasks_company ON public.production_tasks(company_id);
CREATE INDEX idx_production_tasks_status ON public.production_tasks(status);
CREATE INDEX idx_production_tasks_setup_key ON public.production_tasks(setup_key);
CREATE INDEX idx_production_tasks_project ON public.production_tasks(project_id);
CREATE INDEX idx_production_tasks_locked ON public.production_tasks(locked_to_machine_id) WHERE locked_to_machine_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_production_tasks_updated_at
  BEFORE UPDATE ON public.production_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2) machine_queue_items — tasks assigned to specific machines
CREATE TABLE public.machine_queue_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.production_tasks(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  project_id UUID REFERENCES public.work_orders(id),
  work_order_id UUID REFERENCES public.work_orders(id),
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','skipped','canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queue items in their company" ON public.machine_queue_items
  FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admin/workshop can manage queue items" ON public.machine_queue_items
  FOR ALL USING (
    public.has_any_role(auth.uid(), ARRAY['admin','workshop']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- UNIQUE constraint: a task can exist in only one active queue at a time
CREATE UNIQUE INDEX idx_queue_task_active 
  ON public.machine_queue_items(task_id) 
  WHERE status IN ('queued', 'running');

-- Indexes
CREATE INDEX idx_queue_machine ON public.machine_queue_items(machine_id, position);
CREATE INDEX idx_queue_project ON public.machine_queue_items(project_id);
CREATE INDEX idx_queue_status ON public.machine_queue_items(status);

-- Updated_at trigger  
CREATE TRIGGER update_queue_items_updated_at
  BEFORE UPDATE ON public.machine_queue_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_queue_items;
