
-- Add missing SEMrush columns to seo_domains
ALTER TABLE public.seo_domains
  ADD COLUMN IF NOT EXISTS semrush_authority_score integer,
  ADD COLUMN IF NOT EXISTS semrush_organic_keywords integer,
  ADD COLUMN IF NOT EXISTS semrush_organic_traffic integer,
  ADD COLUMN IF NOT EXISTS semrush_organic_cost numeric,
  ADD COLUMN IF NOT EXISTS last_semrush_sync timestamptz;

-- Add missing SEMrush columns to seo_keyword_ai
ALTER TABLE public.seo_keyword_ai
  ADD COLUMN IF NOT EXISTS cpc numeric,
  ADD COLUMN IF NOT EXISTS competition numeric,
  ADD COLUMN IF NOT EXISTS traffic_pct numeric,
  ADD COLUMN IF NOT EXISTS traffic_cost numeric,
  ADD COLUMN IF NOT EXISTS results_count bigint,
  ADD COLUMN IF NOT EXISTS keyword_difficulty numeric,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
