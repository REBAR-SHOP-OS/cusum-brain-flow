
-- 1. lead_events (append-only activity ledger for timeline parity)
CREATE TABLE public.lead_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  source_system text NOT NULL DEFAULT 'erp',
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_events_lead_id ON public.lead_events(lead_id);
CREATE INDEX idx_lead_events_created_at ON public.lead_events(created_at DESC);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead events"
  ON public.lead_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert lead events"
  ON public.lead_events FOR INSERT
  WITH CHECK (true);

-- 2. reconciliation_runs (sync audit table)
CREATE TABLE public.reconciliation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  window_days int NOT NULL DEFAULT 5,
  results jsonb NOT NULL DEFAULT '[]',
  created_count int NOT NULL DEFAULT 0,
  updated_count int NOT NULL DEFAULT 0,
  missing_count int NOT NULL DEFAULT 0,
  out_of_sync_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation runs"
  ON public.reconciliation_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert reconciliation runs"
  ON public.reconciliation_runs FOR INSERT
  WITH CHECK (true);

-- 3. dedup_rollback_log (safe delete history)
CREATE TABLE public.dedup_rollback_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deleted_id uuid NOT NULL,
  survivor_id uuid NOT NULL,
  pre_merge_snapshot jsonb NOT NULL DEFAULT '{}',
  post_merge_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dedup_rollback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view dedup rollback log"
  ON public.dedup_rollback_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert dedup rollback log"
  ON public.dedup_rollback_log FOR INSERT
  WITH CHECK (true);

-- 4. Add processed_at to email_suppressions for SLA monitoring
ALTER TABLE public.email_suppressions
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;
