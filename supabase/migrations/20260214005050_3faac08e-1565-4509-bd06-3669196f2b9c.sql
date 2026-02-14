
-- Phase 1: Tighten overly permissive RLS INSERT policies
-- These tables are written by edge functions using service_role (bypasses RLS),
-- so restrictive policies won't break functionality.

-- 1. dedup_rollback_log: restrict INSERT to admin only
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.dedup_rollback_log;
CREATE POLICY "Admin can insert dedup_rollback_log"
  ON public.dedup_rollback_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. lead_events: restrict INSERT to admin/office/sales
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.lead_events;
CREATE POLICY "CRM roles can insert lead_events"
  ON public.lead_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

-- 3. reconciliation_runs: restrict INSERT to admin only
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.reconciliation_runs;
CREATE POLICY "Admin can insert reconciliation_runs"
  ON public.reconciliation_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
