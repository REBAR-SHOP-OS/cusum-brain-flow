
-- Fix UPDATE policy so admins also only see/update their own communications
DROP POLICY "Users update own communications in company" ON public.communications;

CREATE POLICY "Users update own communications in company"
ON public.communications
FOR UPDATE
USING (
  company_id = get_user_company_id(auth.uid())
  AND user_id = auth.uid()
);
