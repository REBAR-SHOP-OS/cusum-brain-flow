
-- Fix activity_events UPDATE: restrict to admin only (office = read-only)
DROP POLICY IF EXISTS "activity_events_update" ON public.activity_events;
CREATE POLICY "activity_events_update" ON public.activity_events
  FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix lead_events SELECT: scope through lead's company_id
DROP POLICY IF EXISTS "Authenticated users can view lead events" ON public.lead_events;
CREATE POLICY "Company users can view lead events" ON public.lead_events
  FOR SELECT
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE company_id = get_user_company_id(auth.uid())
    )
  );
