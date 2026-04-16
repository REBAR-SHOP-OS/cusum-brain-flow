
ALTER TABLE public.barlist_items ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'mm';
ALTER TABLE public.cut_plan_items ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'mm';
ALTER TABLE public.production_tasks ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'mm';
