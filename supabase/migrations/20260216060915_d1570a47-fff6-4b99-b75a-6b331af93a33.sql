CREATE OR REPLACE FUNCTION public.acquire_autopilot_lock(
  _run_id uuid,
  _company_id uuid,
  _lock_uuid uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _affected integer;
BEGIN
  UPDATE autopilot_runs
  SET execution_lock_uuid = _lock_uuid,
      execution_started_at = now(),
      status = 'executing',
      phase = 'execution',
      started_at = COALESCE(started_at, now())
  WHERE id = _run_id
    AND company_id = _company_id
    AND status IN ('approved', 'failed')
    AND (execution_lock_uuid IS NULL
         OR execution_started_at < now() - interval '5 minutes');
  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$$;