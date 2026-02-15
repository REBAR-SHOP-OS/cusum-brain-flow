
-- Fix overly permissive INSERT policies: change from public role to service_role

-- 1. dedup_rollback_log
DROP POLICY IF EXISTS "Service role can insert dedup rollback log" ON public.dedup_rollback_log;
CREATE POLICY "Service role can insert dedup rollback log"
ON public.dedup_rollback_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. lead_events
DROP POLICY IF EXISTS "Service role can insert lead events" ON public.lead_events;
CREATE POLICY "Service role can insert lead events"
ON public.lead_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. migration_logs
DROP POLICY IF EXISTS "Service role can insert migration logs" ON public.migration_logs;
CREATE POLICY "Service role can insert migration logs"
ON public.migration_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. reconciliation_runs
DROP POLICY IF EXISTS "Service role can insert reconciliation runs" ON public.reconciliation_runs;
CREATE POLICY "Service role can insert reconciliation runs"
ON public.reconciliation_runs
FOR INSERT
TO service_role
WITH CHECK (true);
