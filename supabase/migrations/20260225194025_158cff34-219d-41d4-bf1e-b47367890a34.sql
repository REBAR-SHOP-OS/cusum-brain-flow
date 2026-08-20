
-- Fix work_orders DELETE policy to support project_id/barlist_id links (not just order_id)
DROP POLICY IF EXISTS "Admins can delete work_orders" ON public.work_orders;

CREATE POLICY "Admins can delete work_orders" ON public.work_orders
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = work_orders.order_id AND o.company_id = get_user_company_id(auth.uid()))
    OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = work_orders.project_id AND p.company_id = get_user_company_id(auth.uid()))
    OR
    EXISTS (SELECT 1 FROM barlists b WHERE b.id = work_orders.barlist_id AND b.company_id = get_user_company_id(auth.uid()))
  )
);

-- Add missing DELETE policy for clearance_evidence
CREATE POLICY "Admin and workshop can delete clearance evidence"
ON public.clearance_evidence
FOR DELETE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin'::app_role, 'workshop'::app_role])
);
