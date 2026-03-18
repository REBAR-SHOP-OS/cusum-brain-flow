
ALTER TABLE public.seo_domains 
  ADD COLUMN IF NOT EXISTS semrush_competitors_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS semrush_backlinks_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS semrush_rank_history_json jsonb DEFAULT '[]'::jsonb;
