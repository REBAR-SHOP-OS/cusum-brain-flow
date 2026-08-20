ALTER TABLE public.seo_domains 
  ADD COLUMN IF NOT EXISTS visits_monthly integer,
  ADD COLUMN IF NOT EXISTS unique_visitors_monthly integer,
  ADD COLUMN IF NOT EXISTS pages_per_visit numeric,
  ADD COLUMN IF NOT EXISTS avg_visit_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS bounce_rate numeric,
  ADD COLUMN IF NOT EXISTS visits_change_pct numeric,
  ADD COLUMN IF NOT EXISTS visitors_change_pct numeric,
  ADD COLUMN IF NOT EXISTS traffic_snapshot_month text;