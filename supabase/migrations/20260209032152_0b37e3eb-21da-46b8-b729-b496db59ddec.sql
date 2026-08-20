
-- Drop the overly permissive policies
DROP POLICY "Users can insert activities" ON public.lead_activities;
DROP POLICY "Users can update their activities" ON public.lead_activities;
DROP POLICY "Users can delete their activities" ON public.lead_activities;

-- Recreate with proper company-scoped access
CREATE POLICY "Users can insert activities for their company"
ON public.lead_activities
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update activities for their company"
ON public.lead_activities
FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete activities for their company"
ON public.lead_activities
FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
