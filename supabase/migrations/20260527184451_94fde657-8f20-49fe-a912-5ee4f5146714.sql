
INSERT INTO public.feature_flags(flag_key, enabled, description)
VALUES ('comms_alerts_enabled', true, 'Master kill-switch for internal alert emails (comms-alerts, check-sla-breaches, timeclock-alerts). When false, these functions skip sending.')
ON CONFLICT (flag_key) DO NOTHING;

-- Allow super-admins to toggle this flag from the admin UI.
DROP POLICY IF EXISTS "Super admins manage feature flags" ON public.feature_flags;
CREATE POLICY "Super admins manage feature flags"
  ON public.feature_flags FOR UPDATE TO authenticated
  USING (auth.jwt()->>'email' IN ('sattar@rebar.shop','radin@rebar.shop','zahra@rebar.shop'))
  WITH CHECK (auth.jwt()->>'email' IN ('sattar@rebar.shop','radin@rebar.shop','zahra@rebar.shop'));

GRANT UPDATE ON public.feature_flags TO authenticated;
