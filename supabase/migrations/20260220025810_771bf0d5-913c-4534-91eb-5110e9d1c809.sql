ALTER TABLE public.estimation_items 
  ADD COLUMN IF NOT EXISTS bbox jsonb,
  ADD COLUMN IF NOT EXISTS page_index integer DEFAULT 0;