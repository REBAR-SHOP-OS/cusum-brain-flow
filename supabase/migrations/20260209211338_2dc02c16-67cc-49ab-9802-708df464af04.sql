
-- Drop and recreate SELECT policy so admins also only see their own communications
DROP POLICY "Users read own communications in company" ON public.communications;

CREATE POLICY "Users read own communications in company"
ON public.communications
FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  AND user_id = auth.uid()
);
