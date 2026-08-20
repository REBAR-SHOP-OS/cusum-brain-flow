
-- Tighten purchase_orders SELECT to admin/office/accounting only
DROP POLICY IF EXISTS "Users can view POs in their company" ON public.purchase_orders;
CREATE POLICY "Admin/office/accounting can view POs" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'accounting'::app_role])
  );

-- Add company_id filter to quote_requests policies
DROP POLICY IF EXISTS "Staff can view quote requests" ON public.quote_requests;
CREATE POLICY "Staff can view quote requests" ON public.quote_requests
  FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'sales'::app_role])
  );

DROP POLICY IF EXISTS "Staff can update quote requests" ON public.quote_requests;
CREATE POLICY "Staff can update quote requests" ON public.quote_requests
  FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'sales'::app_role])
  );
