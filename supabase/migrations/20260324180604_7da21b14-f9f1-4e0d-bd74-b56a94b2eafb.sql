-- Drop the partial unique index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS public.idx_activity_events_dedupe_key;

-- Create a proper unique constraint (not partial) so ON CONFLICT works
ALTER TABLE public.activity_events ADD CONSTRAINT activity_events_dedupe_key_unique UNIQUE (dedupe_key);