-- Force PostgREST schema cache reload; status column exists but cache may be stale
COMMENT ON COLUMN public.extract_sessions.status IS 'Extraction lifecycle: uploaded | extracting | extracted | error';
NOTIFY pgrst, 'reload schema';