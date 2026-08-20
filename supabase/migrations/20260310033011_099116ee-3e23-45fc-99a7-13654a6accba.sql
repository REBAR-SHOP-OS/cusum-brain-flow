
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS active_plan_id uuid;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS machine_lock boolean DEFAULT false;
