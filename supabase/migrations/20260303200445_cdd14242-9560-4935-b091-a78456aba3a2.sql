
DROP POLICY IF EXISTS "Office staff can update work_orders" ON public.work_orders;
CREATE POLICY "Staff can update work_orders" ON public.work_orders
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin','office','workshop']::app_role[])
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );
