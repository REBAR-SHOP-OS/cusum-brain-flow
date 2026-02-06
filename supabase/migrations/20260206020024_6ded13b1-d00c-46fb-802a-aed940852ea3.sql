-- Fix remaining RLS policies - replace "true" with authentication checks for all tables

-- accounting_mirror
DROP POLICY IF EXISTS "Authenticated users full access" ON public.accounting_mirror;
CREATE POLICY "Authenticated users can read accounting_mirror"
ON public.accounting_mirror FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert accounting_mirror"
ON public.accounting_mirror FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update accounting_mirror"
ON public.accounting_mirror FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete accounting_mirror"
ON public.accounting_mirror FOR DELETE USING (auth.role() = 'authenticated');

-- customers
DROP POLICY IF EXISTS "Authenticated users full access" ON public.customers;
CREATE POLICY "Authenticated users can read customers"
ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert customers"
ON public.customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update customers"
ON public.customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete customers"
ON public.customers FOR DELETE USING (auth.role() = 'authenticated');

-- deliveries
DROP POLICY IF EXISTS "Authenticated users full access" ON public.deliveries;
CREATE POLICY "Authenticated users can read deliveries"
ON public.deliveries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert deliveries"
ON public.deliveries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update deliveries"
ON public.deliveries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete deliveries"
ON public.deliveries FOR DELETE USING (auth.role() = 'authenticated');

-- events
DROP POLICY IF EXISTS "Authenticated users full access" ON public.events;
CREATE POLICY "Authenticated users can read events"
ON public.events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert events"
ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update events"
ON public.events FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete events"
ON public.events FOR DELETE USING (auth.role() = 'authenticated');

-- integration_settings
DROP POLICY IF EXISTS "Authenticated users full access" ON public.integration_settings;
CREATE POLICY "Authenticated users can read integration_settings"
ON public.integration_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert integration_settings"
ON public.integration_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update integration_settings"
ON public.integration_settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete integration_settings"
ON public.integration_settings FOR DELETE USING (auth.role() = 'authenticated');

-- knowledge
DROP POLICY IF EXISTS "Authenticated users full access" ON public.knowledge;
CREATE POLICY "Authenticated users can read knowledge"
ON public.knowledge FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert knowledge"
ON public.knowledge FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update knowledge"
ON public.knowledge FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete knowledge"
ON public.knowledge FOR DELETE USING (auth.role() = 'authenticated');

-- orders
DROP POLICY IF EXISTS "Authenticated users full access" ON public.orders;
CREATE POLICY "Authenticated users can read orders"
ON public.orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert orders"
ON public.orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update orders"
ON public.orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete orders"
ON public.orders FOR DELETE USING (auth.role() = 'authenticated');

-- quotes
DROP POLICY IF EXISTS "Authenticated users full access" ON public.quotes;
CREATE POLICY "Authenticated users can read quotes"
ON public.quotes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert quotes"
ON public.quotes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update quotes"
ON public.quotes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete quotes"
ON public.quotes FOR DELETE USING (auth.role() = 'authenticated');

-- tasks
DROP POLICY IF EXISTS "Authenticated users full access" ON public.tasks;
CREATE POLICY "Authenticated users can read tasks"
ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert tasks"
ON public.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tasks"
ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete tasks"
ON public.tasks FOR DELETE USING (auth.role() = 'authenticated');

-- work_orders
DROP POLICY IF EXISTS "Authenticated users full access" ON public.work_orders;
CREATE POLICY "Authenticated users can read work_orders"
ON public.work_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert work_orders"
ON public.work_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update work_orders"
ON public.work_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete work_orders"
ON public.work_orders FOR DELETE USING (auth.role() = 'authenticated');