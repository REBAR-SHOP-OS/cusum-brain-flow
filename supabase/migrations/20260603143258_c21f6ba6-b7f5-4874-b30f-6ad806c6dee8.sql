-- Force PostgREST to rebuild its schema cache for extract_sessions.
-- The column exists but the cache is stale. A no-op type change on the
-- existing column triggers a DDL event that PostgREST listens for.
ALTER TABLE public.extract_sessions ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.extract_sessions ALTER COLUMN status SET DEFAULT 'uploaded';
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst;