
-- Fix overly permissive RLS policies on custom_shape_schematics
-- DELETE: Only admin can delete
DROP POLICY IF EXISTS "Authenticated users can delete schematics" ON public.custom_shape_schematics;
CREATE POLICY "Admin can delete schematics"
  ON public.custom_shape_schematics
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT: Only admin/office can insert
DROP POLICY IF EXISTS "Authenticated users can insert schematics" ON public.custom_shape_schematics;
CREATE POLICY "Admin and office can insert schematics"
  ON public.custom_shape_schematics
  FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

-- Add UPDATE policy (was missing)
CREATE POLICY "Admin can update schematics"
  ON public.custom_shape_schematics
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add missing indexes for performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_plan_id ON public.cut_plan_items(cut_plan_id);
CREATE INDEX IF NOT EXISTS idx_cut_plan_items_bar_code ON public.cut_plan_items(bar_code);
CREATE INDEX IF NOT EXISTS idx_cut_plans_machine_id ON public.cut_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_cut_plans_status ON public.cut_plans(status);
CREATE INDEX IF NOT EXISTS idx_machine_runs_machine_status ON public.machine_runs(machine_id, status);
CREATE INDEX IF NOT EXISTS idx_events_entity_type ON public.events(entity_type);
CREATE INDEX IF NOT EXISTS idx_production_tasks_status ON public.production_tasks(status);
CREATE INDEX IF NOT EXISTS idx_queue_items_company ON public.machine_queue_items(company_id);
