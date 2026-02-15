
-- Fix: replace overly permissive service role policy with auth.role() check
DROP POLICY "Service role full access to link audits" ON public.seo_link_audit;

CREATE POLICY "Service role full access to link audits"
  ON public.seo_link_audit FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
