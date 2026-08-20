
CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  function_name text,
  active boolean,
  last_start timestamptz,
  last_end timestamptz,
  last_status text,
  last_message text,
  runs_24h bigint,
  failures_24h bigint,
  http_auth_failures_24h bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT j.jobid, j.jobname, j.schedule, j.active,
           substring(j.command from 'functions/v1/([a-z0-9-]+)') AS fn
    FROM cron.job j
    WHERE j.jobname IN (
      'check-escalations-every-5min',
      'comms-alerts-check',
      'email-automation-check-hourly',
      'friday-improvement-ideas',
      'social-cron-publish-every-5min',
      'timeclock-missed-clockin',
      'timeclock-missed-clockout',
      'vizzy-business-watchdog-15min'
    )
  ),
  last_run AS (
    SELECT DISTINCT ON (d.jobid) d.jobid, d.start_time, d.end_time, d.status, d.return_message
    FROM cron.job_run_details d
    WHERE d.jobid IN (SELECT t.jobid FROM target t)
    ORDER BY d.jobid, d.start_time DESC
  ),
  agg AS (
    SELECT d.jobid,
           count(*)::bigint AS runs,
           count(*) FILTER (WHERE d.status = 'failed')::bigint AS failures
    FROM cron.job_run_details d
    WHERE d.jobid IN (SELECT t.jobid FROM target t)
      AND d.start_time > now() - interval '24 hours'
    GROUP BY d.jobid
  ),
  http_fail AS (
    SELECT t.jobid,
           count(*) FILTER (
             WHERE r.status_code IN (401, 403)
               AND r.content ILIKE '%' || t.fn || '%'
           )::bigint AS auth_fails
    FROM target t
    LEFT JOIN net._http_response r
      ON r.created > now() - interval '24 hours'
    GROUP BY t.jobid
  )
  SELECT t.jobid, t.jobname, t.schedule, t.fn, t.active,
         lr.start_time, lr.end_time, lr.status, lr.return_message,
         COALESCE(a.runs, 0), COALESCE(a.failures, 0),
         COALESCE(hf.auth_fails, 0)
  FROM target t
  LEFT JOIN last_run lr ON lr.jobid = t.jobid
  LEFT JOIN agg a ON a.jobid = t.jobid
  LEFT JOIN http_fail hf ON hf.jobid = t.jobid
  ORDER BY t.jobname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cron_health() TO authenticated;
