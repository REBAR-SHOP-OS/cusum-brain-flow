
-- Tighten work_orders UPDATE: remove workshop role (workers are read-only)
DROP POLICY IF EXISTS "Office staff can update work_orders" ON public.work_orders;

CREATE POLICY "Office staff can update work_orders"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));
