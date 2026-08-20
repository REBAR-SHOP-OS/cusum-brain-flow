
ALTER TABLE public.seo_domains
  ADD COLUMN IF NOT EXISTS visibility_pct numeric,
  ADD COLUMN IF NOT EXISTS estimated_traffic_pct numeric,
  ADD COLUMN IF NOT EXISTS avg_position numeric,
  ADD COLUMN IF NOT EXISTS top3_keywords integer,
  ADD COLUMN IF NOT EXISTS top10_keywords integer,
  ADD COLUMN IF NOT EXISTS total_tracked_keywords integer,
  ADD COLUMN IF NOT EXISTS position_tracking_date text;

ALTER TABLE public.seo_page_ai
  ADD COLUMN IF NOT EXISTS issues_json jsonb;
