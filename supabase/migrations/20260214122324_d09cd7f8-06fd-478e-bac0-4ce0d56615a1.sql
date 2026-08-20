
-- Fix: communications SELECT - restrict to own communications, or admin/office can see all
DROP POLICY "Users read all communications in company" ON public.communications;

CREATE POLICY "Users read own or admin reads all communications"
ON public.communications
FOR SELECT
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  )
);
