
-- Drop the current overly broad SELECT policy
DROP POLICY "Users read own communications in company" ON public.communications;

-- Recreate: users see their own; admins see all in company
CREATE POLICY "Users read own communications in company"
ON public.communications
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
