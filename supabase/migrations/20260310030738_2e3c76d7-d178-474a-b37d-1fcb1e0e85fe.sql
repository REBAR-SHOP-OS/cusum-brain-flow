
ALTER TABLE public.extract_rows ADD COLUMN IF NOT EXISTS duplicate_key text;
ALTER TABLE public.extract_rows ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.extract_rows(id);
ALTER TABLE public.extract_rows ADD COLUMN IF NOT EXISTS original_quantity integer;
CREATE INDEX IF NOT EXISTS idx_extract_rows_duplicate_key ON public.extract_rows(session_id, duplicate_key);
