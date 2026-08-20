
-- ============================================
-- glasses_captures
-- ============================================
DROP POLICY IF EXISTS "Allow public insert on glasses_captures" ON public.glasses_captures;
DROP POLICY IF EXISTS "Allow authenticated read on glasses_captures" ON public.glasses_captures;

CREATE POLICY "Authenticated users can read own company glasses captures"
  ON public.glasses_captures FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid())::text);

CREATE POLICY "Service role can insert glasses captures"
  ON public.glasses_captures FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================
-- lead_files
-- ============================================
DROP POLICY IF EXISTS "Anon can read lead files" ON public.lead_files;

DROP POLICY IF EXISTS "Users can view lead files in their company" ON public.lead_files;
CREATE POLICY "Users can view lead files in their company"
  ON public.lead_files FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert lead files in their company" ON public.lead_files;
CREATE POLICY "Users can insert lead files in their company"
  ON public.lead_files FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete lead files in their company" ON public.lead_files;
CREATE POLICY "Users can delete lead files in their company"
  ON public.lead_files FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- ============================================
-- custom_shape_schematics
-- ============================================
DROP POLICY IF EXISTS "Admin and office can insert schematics" ON public.custom_shape_schematics;
CREATE POLICY "Admin and office can insert schematics"
  ON public.custom_shape_schematics FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role]));

DROP POLICY IF EXISTS "Admin can update schematics" ON public.custom_shape_schematics;
CREATE POLICY "Admin can update schematics"
  ON public.custom_shape_schematics FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin can delete schematics" ON public.custom_shape_schematics;
CREATE POLICY "Admin can delete schematics"
  ON public.custom_shape_schematics FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
