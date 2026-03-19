CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_events_dedupe_key 
ON public.activity_events (dedupe_key) 
WHERE dedupe_key IS NOT NULL;