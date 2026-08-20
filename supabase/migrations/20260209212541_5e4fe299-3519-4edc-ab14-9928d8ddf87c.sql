
-- Update SELECT policy: all company members can see all company communications (shared inbox)
DROP POLICY "Users read own communications in company" ON public.communications;

CREATE POLICY "Company members read all company communications"
ON public.communications
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));
