CREATE OR REPLACE FUNCTION public.claim_extract_session(
  _session_id uuid,
  _stale_cutoff timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean := false;
BEGIN
  UPDATE public.extract_sessions
  SET
    status = 'extracting',
    progress = 0,
    error_message = NULL,
    updated_at = now()
  WHERE id = _session_id
    AND (status <> 'extracting' OR updated_at < _stale_cutoff)
  RETURNING true INTO _claimed;

  RETURN COALESCE(_claimed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_extract_session(uuid, timestamptz) TO service_role;
NOTIFY pgrst, 'reload schema';