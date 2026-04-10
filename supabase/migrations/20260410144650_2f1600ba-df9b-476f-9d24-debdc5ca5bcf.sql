ALTER TABLE public.extract_rows
  ADD COLUMN IF NOT EXISTS source_total_length_text text,
  ADD COLUMN IF NOT EXISTS source_dims_json jsonb;