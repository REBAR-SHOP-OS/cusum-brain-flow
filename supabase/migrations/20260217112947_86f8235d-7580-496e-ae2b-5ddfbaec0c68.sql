
-- Tighten INSERT policy: drop the permissive one and restrict to service_role only
-- (RLS INSERT with service_role bypass is implicit, but we make intent explicit)
DROP POLICY "Service role insert" ON public.trial_balance_checks;

-- No INSERT policy for anon/authenticated — only service_role (which bypasses RLS) can insert
-- Add explicit denial: no authenticated user can insert
CREATE POLICY "No client insert" ON public.trial_balance_checks
  FOR INSERT WITH CHECK (false);
