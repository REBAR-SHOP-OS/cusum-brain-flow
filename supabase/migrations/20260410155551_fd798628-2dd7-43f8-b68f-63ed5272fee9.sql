ALTER TABLE public.cut_plan_items ADD COLUMN IF NOT EXISTS source_total_length_text text;
ALTER TABLE public.cut_plan_items ADD COLUMN IF NOT EXISTS source_dims_json jsonb;