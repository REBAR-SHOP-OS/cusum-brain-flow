DROP POLICY IF EXISTS "Users can view activities for their company leads" ON lead_activities;
CREATE POLICY "Users can view activities for their company"
  ON lead_activities FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));