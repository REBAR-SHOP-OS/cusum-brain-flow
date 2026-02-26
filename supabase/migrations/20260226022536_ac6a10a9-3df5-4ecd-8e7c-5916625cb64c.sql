
-- Unique composite index for webhook dedup (replaces time-window query)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qb_webhook_events_dedupe 
  ON public.qb_webhook_events (realm_id, entity_type, entity_id, operation)
  WHERE processed_at IS NULL;

-- Add dedupe_key column for stronger dedup
ALTER TABLE public.qb_webhook_events 
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT GENERATED ALWAYS AS 
    (realm_id || ':' || entity_type || ':' || entity_id || ':' || operation) STORED;

-- Sync lock table for single-flight protection
CREATE TABLE IF NOT EXISTS public.qb_sync_locks (
  company_id UUID NOT NULL,
  action TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  PRIMARY KEY (company_id, action)
);
ALTER TABLE public.qb_sync_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access qb_sync_locks" 
  ON public.qb_sync_locks FOR ALL USING (true) WITH CHECK (true);

-- QB API failure log table
CREATE TABLE IF NOT EXISTS public.qb_api_failures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  realm_id TEXT,
  endpoint TEXT NOT NULL,
  operation TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  request_summary JSONB,
  correlation_id TEXT,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qb_api_failures_company ON public.qb_api_failures (company_id, created_at DESC);
ALTER TABLE public.qb_api_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access qb_api_failures" 
  ON public.qb_api_failures FOR ALL USING (true) WITH CHECK (true);
