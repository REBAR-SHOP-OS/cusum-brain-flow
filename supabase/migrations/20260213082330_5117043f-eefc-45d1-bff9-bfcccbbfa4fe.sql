
-- Tighten the INSERT policy: only service_role (no auth.uid()) can insert
DROP POLICY IF EXISTS "System can insert escalation logs" ON public.sla_escalation_log;

CREATE POLICY "Service role inserts escalation logs"
  ON public.sla_escalation_log FOR INSERT
  WITH CHECK (auth.uid() IS NULL);
