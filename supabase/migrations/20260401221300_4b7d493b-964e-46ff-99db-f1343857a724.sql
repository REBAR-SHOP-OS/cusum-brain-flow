
-- ============================================
-- camera_events: restrict INSERT to service_role
-- The current INSERT policy allows any authenticated user
-- with WITH CHECK(true). Camera events are system-generated.
-- ============================================
DROP POLICY IF EXISTS "Service can insert camera events" ON public.camera_events;
CREATE POLICY "Service role can insert camera events"
  ON public.camera_events FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================
-- clearance_evidence: create join-based company check
-- FK chain: clearance_evidence.cut_plan_item_id
--   → cut_plan_items.id (has cut_plan_id)
--   → cut_plans.id (has company_id)
-- ============================================
CREATE OR REPLACE FUNCTION public.clearance_evidence_company_check(p_cut_plan_item_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT cp.company_id
  FROM cut_plan_items cpi
  JOIN cut_plans cp ON cp.id = cpi.cut_plan_id
  WHERE cpi.id = p_cut_plan_item_id
  LIMIT 1;
$$;

-- Replace open SELECT with company-scoped via helper
DROP POLICY IF EXISTS "Authenticated users can view clearance evidence" ON public.clearance_evidence;
CREATE POLICY "Authenticated users can view clearance evidence"
  ON public.clearance_evidence FOR SELECT TO authenticated
  USING (clearance_evidence_company_check(cut_plan_item_id) = get_user_company_id(auth.uid()));
