ALTER TABLE public.extract_sessions
  ADD COLUMN IF NOT EXISTS tags_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tags_printed_by uuid,
  ADD COLUMN IF NOT EXISTS tags_print_count integer NOT NULL DEFAULT 0;