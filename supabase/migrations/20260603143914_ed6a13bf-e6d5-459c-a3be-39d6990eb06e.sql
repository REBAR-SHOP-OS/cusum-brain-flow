REVOKE EXECUTE ON FUNCTION public.claim_extract_session(uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_extract_session(uuid, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_extract_session(uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_extract_session(uuid, timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';