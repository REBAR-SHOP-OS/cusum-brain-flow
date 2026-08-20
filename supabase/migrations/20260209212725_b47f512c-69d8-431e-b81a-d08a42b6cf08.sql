
-- Revert to user-scoped communications
DROP POLICY "Company members read all company communications" ON public.communications;

CREATE POLICY "Users read own communications in company"
ON public.communications
FOR SELECT
USING (company_id = get_user_company_id(auth.uid()) AND user_id = auth.uid());
