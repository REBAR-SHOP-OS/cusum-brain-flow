
-- Replace broad SELECT: sales/accounting can only read their own assigned leads
DROP POLICY IF EXISTS "Sales team reads leads in company" ON public.leads;

CREATE POLICY "Sales team reads own leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_any_role(auth.uid(), ARRAY['sales'::app_role, 'accounting'::app_role])
      AND assigned_to = auth.uid()
    )
  )
);

-- Replace broad UPDATE: sales/accounting can only update their own assigned leads
DROP POLICY IF EXISTS "Sales team updates leads in company" ON public.leads;

CREATE POLICY "Sales team updates own leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_any_role(auth.uid(), ARRAY['sales'::app_role, 'accounting'::app_role])
      AND assigned_to = auth.uid()
    )
  )
);
