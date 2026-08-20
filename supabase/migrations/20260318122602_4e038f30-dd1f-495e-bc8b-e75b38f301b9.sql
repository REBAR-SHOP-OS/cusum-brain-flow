
-- Add Wincher columns to seo_domains
ALTER TABLE public.seo_domains
  ADD COLUMN IF NOT EXISTS wincher_website_id integer,
  ADD COLUMN IF NOT EXISTS wincher_data_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_rank_history_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_competitors_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_groups_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_annotations_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_synced_at timestamptz;

-- Add Wincher columns to seo_keyword_ai
ALTER TABLE public.seo_keyword_ai
  ADD COLUMN IF NOT EXISTS wincher_keyword_id integer,
  ADD COLUMN IF NOT EXISTS wincher_position integer,
  ADD COLUMN IF NOT EXISTS wincher_position_change integer,
  ADD COLUMN IF NOT EXISTS wincher_traffic numeric,
  ADD COLUMN IF NOT EXISTS wincher_difficulty integer,
  ADD COLUMN IF NOT EXISTS wincher_cpc numeric,
  ADD COLUMN IF NOT EXISTS wincher_best_position integer,
  ADD COLUMN IF NOT EXISTS wincher_serp_features_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_ranking_pages_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_position_history_json jsonb,
  ADD COLUMN IF NOT EXISTS wincher_synced_at timestamptz;
