DROP POLICY "Admin can delete sessions" ON public.extract_sessions;

CREATE POLICY "Admin and office can delete sessions"
  ON public.extract_sessions
  FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  );