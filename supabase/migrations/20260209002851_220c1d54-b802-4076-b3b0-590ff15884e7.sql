
-- Fix overly permissive insert policy on contact_access_log
DROP POLICY "System can insert audit logs" ON public.contact_access_log;

CREATE POLICY "Authenticated users can insert own audit logs"
  ON public.contact_access_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
