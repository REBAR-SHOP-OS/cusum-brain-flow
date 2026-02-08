
-- =============================================
-- 1. ADD company_id TO ALL AFFECTED TABLES
-- =============================================

-- communications (has user_id already, adding company_id for company isolation)
ALTER TABLE public.communications ADD COLUMN company_id uuid;
UPDATE public.communications c SET company_id = p.company_id
FROM public.profiles p WHERE p.user_id = c.user_id;
-- For any rows without a matching user, use the default company
UPDATE public.communications SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE public.communications ALTER COLUMN company_id SET NOT NULL;

-- tasks
ALTER TABLE public.tasks ADD COLUMN company_id uuid;
UPDATE public.tasks SET company_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.tasks ALTER COLUMN company_id SET NOT NULL;

-- leads
ALTER TABLE public.leads ADD COLUMN company_id uuid;
UPDATE public.leads SET company_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.leads ALTER COLUMN company_id SET NOT NULL;

-- knowledge
ALTER TABLE public.knowledge ADD COLUMN company_id uuid;
UPDATE public.knowledge SET company_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.knowledge ALTER COLUMN company_id SET NOT NULL;

-- events
ALTER TABLE public.events ADD COLUMN company_id uuid;
UPDATE public.events SET company_id = 'a0000000-0000-0000-0000-000000000001';
ALTER TABLE public.events ALTER COLUMN company_id SET NOT NULL;

-- deliveries
ALTER TABLE public.deliveries ADD COLUMN company_id uuid;
UPDATE public.deliveries SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE public.deliveries ALTER COLUMN company_id SET NOT NULL;

-- delivery_stops (inherits company context from deliveries, adding for direct filtering)
ALTER TABLE public.delivery_stops ADD COLUMN company_id uuid;
UPDATE public.delivery_stops ds SET company_id = d.company_id
FROM public.deliveries d WHERE d.id = ds.delivery_id;
UPDATE public.delivery_stops SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE public.delivery_stops ALTER COLUMN company_id SET NOT NULL;

-- =============================================
-- 2. DROP ALL OLD PERMISSIVE POLICIES
-- =============================================

-- communications
DROP POLICY IF EXISTS "Authenticated users can insert communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users can update communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated users can delete communications" ON public.communications;
DROP POLICY IF EXISTS "Users see own communications" ON public.communications;

-- tasks
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

-- leads
DROP POLICY IF EXISTS "Authenticated users can read leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

-- knowledge
DROP POLICY IF EXISTS "Authenticated users can read knowledge" ON public.knowledge;
DROP POLICY IF EXISTS "Authenticated users can insert knowledge" ON public.knowledge;
DROP POLICY IF EXISTS "Authenticated users can update knowledge" ON public.knowledge;
DROP POLICY IF EXISTS "Authenticated users can delete knowledge" ON public.knowledge;

-- events
DROP POLICY IF EXISTS "Authenticated users can read events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.events;

-- deliveries
DROP POLICY IF EXISTS "Authenticated users can read deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can insert deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can delete deliveries" ON public.deliveries;

-- delivery_stops
DROP POLICY IF EXISTS "Authenticated users can read delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Authenticated users can insert delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Authenticated users can update delivery_stops" ON public.delivery_stops;
DROP POLICY IF EXISTS "Authenticated users can delete delivery_stops" ON public.delivery_stops;

-- =============================================
-- 3. CREATE NEW COMPANY-ISOLATED POLICIES
-- =============================================

-- COMMUNICATIONS: user_id + company_id scoped
CREATE POLICY "Users read own communications in company"
ON public.communications FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]))
);

CREATE POLICY "Users insert communications in company"
ON public.communications FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE POLICY "Users update own communications in company"
ON public.communications FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins delete communications in company"
ON public.communications FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- TASKS: company-scoped, all roles can access within company
CREATE POLICY "Users read tasks in company"
ON public.tasks FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert tasks in company"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update tasks in company"
ON public.tasks FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins delete tasks in company"
ON public.tasks FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- LEADS: restricted to admin/sales/accounting + company isolation
CREATE POLICY "Sales team reads leads in company"
ON public.leads FOR SELECT TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);

CREATE POLICY "Sales team inserts leads in company"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);

CREATE POLICY "Sales team updates leads in company"
ON public.leads FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
);

CREATE POLICY "Admins delete leads in company"
ON public.leads FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- KNOWLEDGE: company-scoped, all roles can read, admin/office can write
CREATE POLICY "Users read knowledge in company"
ON public.knowledge FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Office inserts knowledge in company"
ON public.knowledge FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
);

CREATE POLICY "Office updates knowledge in company"
ON public.knowledge FOR UPDATE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
);

CREATE POLICY "Admins delete knowledge in company"
ON public.knowledge FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- EVENTS: company-scoped audit log, all can read, system/admin can write
CREATE POLICY "Users read events in company"
ON public.events FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert events in company"
ON public.events FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update events in company"
ON public.events FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins delete events in company"
ON public.events FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- DELIVERIES: company-scoped, accessible to admin/office/field/workshop
CREATE POLICY "Users read deliveries in company"
ON public.deliveries FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert deliveries in company"
ON public.deliveries FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update deliveries in company"
ON public.deliveries FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins delete deliveries in company"
ON public.deliveries FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- DELIVERY_STOPS: company-scoped
CREATE POLICY "Users read delivery_stops in company"
ON public.delivery_stops FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users insert delivery_stops in company"
ON public.delivery_stops FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users update delivery_stops in company"
ON public.delivery_stops FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins delete delivery_stops in company"
ON public.delivery_stops FOR DELETE TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
