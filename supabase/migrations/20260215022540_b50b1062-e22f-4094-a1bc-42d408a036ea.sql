
-- Speed audit results tracking table
CREATE TABLE public.speed_audit_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_url TEXT NOT NULL,
  ttfb_ms INTEGER,
  fcp_ms INTEGER,
  lcp_ms INTEGER,
  cls NUMERIC(5,3),
  performance_score INTEGER,
  issues JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  company_id TEXT NOT NULL DEFAULT 'rebar-shop'
);

ALTER TABLE public.speed_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view speed audits"
  ON public.speed_audit_results FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE INDEX idx_speed_audit_results_page ON public.speed_audit_results(page_url, audited_at DESC);
