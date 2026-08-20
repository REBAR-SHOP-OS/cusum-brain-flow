-- Expand DELETE policies on barlists, projects, cut_plans to allow office role

DROP POLICY IF EXISTS "Admin can delete barlists" ON barlists;
CREATE POLICY "Admin or office can delete barlists" ON barlists
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office'::app_role)));

DROP POLICY IF EXISTS "Admin can delete projects" ON projects;
CREATE POLICY "Admin or office can delete projects" ON projects
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office'::app_role)));

DROP POLICY IF EXISTS "Admins can delete cut_plans" ON cut_plans;
CREATE POLICY "Admin or office can delete cut_plans" ON cut_plans
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'office'::app_role)));