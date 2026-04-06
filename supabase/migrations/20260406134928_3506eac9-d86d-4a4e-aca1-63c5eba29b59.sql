-- Drop the broken admin SELECT policy
DROP POLICY IF EXISTS "Admins can read company vizzy_memory" ON public.vizzy_memory;

-- Create correct admin policies using security-definer helpers
CREATE POLICY "Admin select company memories"
  ON public.vizzy_memory FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin update company memories"
  ON public.vizzy_memory FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin delete company memories"
  ON public.vizzy_memory FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );