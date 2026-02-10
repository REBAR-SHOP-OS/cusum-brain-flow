
-- Fix SELECT policy: allow sales/accounting to see ALL company leads
DROP POLICY IF EXISTS "Sales team reads own leads" ON public.leads;

CREATE POLICY "Sales team reads leads in company"
ON public.leads FOR SELECT TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);

-- Fix UPDATE policy: allow sales/accounting to update any company lead
DROP POLICY IF EXISTS "Sales team updates own leads" ON public.leads;

CREATE POLICY "Sales team updates leads in company"
ON public.leads FOR UPDATE TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);
