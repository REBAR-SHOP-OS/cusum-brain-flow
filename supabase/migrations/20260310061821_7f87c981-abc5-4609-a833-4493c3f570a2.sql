ALTER TABLE public.extract_sessions 
ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_message text;