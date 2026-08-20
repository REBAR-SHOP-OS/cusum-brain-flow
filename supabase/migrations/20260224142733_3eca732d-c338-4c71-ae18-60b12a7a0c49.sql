
-- Fix: UPDATE policy on communications uses public role instead of authenticated
DROP POLICY IF EXISTS "Users update own communications in company" ON public.communications;

CREATE POLICY "Users update own communications in company"
  ON public.communications
  FOR UPDATE
  TO authenticated
  USING ((company_id = get_user_company_id(auth.uid())) AND (user_id = auth.uid()));
