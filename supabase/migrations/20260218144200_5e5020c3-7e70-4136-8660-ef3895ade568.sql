
-- Drop the overly-permissive policy that allows 'office' role to see all company communications
DROP POLICY IF EXISTS "Users read own or admin reads all communications" ON public.communications;

-- New strict policy: users see only their own communications; only admins see all
CREATE POLICY "Users read own communications; admins read all"
ON public.communications
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
