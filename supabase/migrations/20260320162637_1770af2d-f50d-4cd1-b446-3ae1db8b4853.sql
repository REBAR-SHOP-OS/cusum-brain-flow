ALTER TABLE public.extract_rows 
  ADD COLUMN IF NOT EXISTS raw_total_length_mm numeric,
  ADD COLUMN IF NOT EXISTS raw_dims_json jsonb;