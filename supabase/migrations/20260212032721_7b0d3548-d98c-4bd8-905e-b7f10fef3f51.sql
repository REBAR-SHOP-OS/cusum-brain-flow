
-- =====================================================
-- FIX REAL RLS POLICY GAPS
-- =====================================================

-- 1. QUOTES: Add company_id scoping to all policies
DROP POLICY IF EXISTS "Sales/Accounting/Admin can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Sales/Accounting/Admin can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Sales/Accounting/Admin can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admin can delete quotes" ON public.quotes;

CREATE POLICY "Sales/Accounting/Admin can read quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );

CREATE POLICY "Sales/Accounting/Admin can insert quotes" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );

CREATE POLICY "Sales/Accounting/Admin can update quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'sales'::app_role, 'accounting'::app_role])
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );

CREATE POLICY "Admin can delete quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL)
  );

-- 2. WORK_ORDERS: Add company scoping via order -> company_id
DROP POLICY IF EXISTS "Staff can read work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Office staff can insert work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Office staff can update work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admins can delete work_orders" ON public.work_orders;

CREATE POLICY "Staff can read work_orders" ON public.work_orders
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role, 'workshop'::app_role, 'field'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Office staff can insert work_orders" ON public.work_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Office staff can update work_orders" ON public.work_orders
  FOR UPDATE TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Admins can delete work_orders" ON public.work_orders
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = work_orders.order_id
        AND o.company_id = get_user_company_id(auth.uid())
    )
  );

-- 3. MEETING_TRANSCRIPT_ENTRIES: Scope to channel membership
DROP POLICY IF EXISTS "Authenticated users can read transcript entries" ON public.meeting_transcript_entries;

CREATE POLICY "Channel members can read transcript entries" ON public.meeting_transcript_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_meetings tm
      WHERE tm.id = meeting_transcript_entries.meeting_id
        AND (
          is_channel_member(auth.uid(), tm.channel_id)
          OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
        )
    )
  );

-- 4. MEETING_ACTION_ITEMS: Scope to channel membership via meeting
DROP POLICY IF EXISTS "Authenticated users can read action items" ON public.meeting_action_items;

CREATE POLICY "Channel members can read action items" ON public.meeting_action_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_meetings tm
      WHERE tm.id = meeting_action_items.meeting_id
        AND (
          is_channel_member(auth.uid(), tm.channel_id)
          OR has_any_role(auth.uid(), ARRAY['admin'::app_role])
        )
    )
  );

-- 5. TIME_CLOCK_ENTRIES: Scope to company
DROP POLICY IF EXISTS "Authenticated users can view all clock entries" ON public.time_clock_entries;

CREATE POLICY "Company members can view clock entries" ON public.time_clock_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = time_clock_entries.profile_id
        AND p.company_id = get_user_company_id(auth.uid())
    )
  );

-- 6. PROFILES_SAFE view: Recreate with security_invoker
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
  SELECT
    id,
    user_id,
    full_name,
    title,
    department,
    duties,
    phone,
    email,
    avatar_url,
    is_active,
    preferred_language,
    employee_type,
    created_at,
    updated_at
  FROM public.profiles;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Also add a broader SELECT policy on profiles for company members
-- (profiles_safe with security_invoker needs the base table policies to work)
-- Current policies only allow own profile + admin. Let's add company-member read.
CREATE POLICY "Company members can read company profiles"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));
