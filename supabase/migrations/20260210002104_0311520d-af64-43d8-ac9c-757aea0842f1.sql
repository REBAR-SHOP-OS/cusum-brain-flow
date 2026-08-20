
-- 1. Make clearance-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'clearance-photos';

-- 2. Harden work_orders: replace generic 'authenticated' policies with role-based ones
-- work_orders are linked to projects/orders, restrict to relevant roles
DROP POLICY IF EXISTS "Authenticated users can read work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can insert work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can update work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Authenticated users can delete work_orders" ON public.work_orders;

CREATE POLICY "Staff can read work_orders"
ON public.work_orders FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role, 'field'::app_role]));

CREATE POLICY "Office staff can insert work_orders"
ON public.work_orders FOR INSERT TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

CREATE POLICY "Office staff can update work_orders"
ON public.work_orders FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role]));

CREATE POLICY "Admins can delete work_orders"
ON public.work_orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Harden deliveries: restrict to relevant roles
DROP POLICY IF EXISTS "Users read deliveries in company" ON public.deliveries;
DROP POLICY IF EXISTS "Users insert deliveries in company" ON public.deliveries;
DROP POLICY IF EXISTS "Users update deliveries in company" ON public.deliveries;

CREATE POLICY "Delivery staff read deliveries"
ON public.deliveries FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid()) 
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role, 'workshop'::app_role]));

CREATE POLICY "Office staff insert deliveries"
ON public.deliveries FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role]));

CREATE POLICY "Office staff update deliveries"
ON public.deliveries FOR UPDATE TO authenticated
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role]));

-- 4. Harden delivery_stops
DROP POLICY IF EXISTS "Users read delivery_stops in company" ON public.delivery_stops;
DROP POLICY IF EXISTS "Users insert delivery_stops in company" ON public.delivery_stops;
DROP POLICY IF EXISTS "Users update delivery_stops in company" ON public.delivery_stops;

CREATE POLICY "Delivery staff read delivery_stops"
ON public.delivery_stops FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role, 'workshop'::app_role]));

CREATE POLICY "Office staff insert delivery_stops"
ON public.delivery_stops FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role]));

CREATE POLICY "Office staff update delivery_stops"
ON public.delivery_stops FOR UPDATE TO authenticated
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'field'::app_role]));

-- 5. Harden events: restrict to relevant roles
DROP POLICY IF EXISTS "Users read events in company" ON public.events;
DROP POLICY IF EXISTS "Users insert events in company" ON public.events;
DROP POLICY IF EXISTS "Users update events in company" ON public.events;

CREATE POLICY "Staff read events in company"
ON public.events FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role, 'field'::app_role, 'sales'::app_role, 'accounting'::app_role]));

CREATE POLICY "Staff insert events in company"
ON public.events FOR INSERT TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role, 'field'::app_role, 'sales'::app_role, 'accounting'::app_role]));

CREATE POLICY "Staff update events in company"
ON public.events FOR UPDATE TO authenticated
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role, 'field'::app_role, 'sales'::app_role, 'accounting'::app_role]));
