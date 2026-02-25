ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title_local TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS description_local TEXT;