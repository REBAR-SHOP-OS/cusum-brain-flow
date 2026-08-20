
DROP POLICY IF EXISTS "Users read own communications in company" ON public.communications;

CREATE POLICY "Users read all communications in company"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
