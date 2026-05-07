
-- 1) document_attachments: fix INSERT policy join key
DROP POLICY IF EXISTS "Users can insert attachments for their company" ON public.document_attachments;
CREATE POLICY "Users can insert attachments for their company"
ON public.document_attachments FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view their company attachments" ON public.document_attachments;
CREATE POLICY "Users can view their company attachments"
ON public.document_attachments FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- 2) sales_quotation_items: fix all 4 policies
DROP POLICY IF EXISTS "Users can view own company quotation items" ON public.sales_quotation_items;
DROP POLICY IF EXISTS "Users can insert own company quotation items" ON public.sales_quotation_items;
DROP POLICY IF EXISTS "Users can update own company quotation items" ON public.sales_quotation_items;
DROP POLICY IF EXISTS "Users can delete own company quotation items" ON public.sales_quotation_items;

CREATE POLICY "Users can view own company quotation items"
ON public.sales_quotation_items FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert own company quotation items"
ON public.sales_quotation_items FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update own company quotation items"
ON public.sales_quotation_items FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete own company quotation items"
ON public.sales_quotation_items FOR DELETE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

-- 3) quote_audit_log: fix both policies
DROP POLICY IF EXISTS "Users can read own company audit logs" ON public.quote_audit_log;
DROP POLICY IF EXISTS "Users can insert own company audit logs" ON public.quote_audit_log;

CREATE POLICY "Users can read own company audit logs"
ON public.quote_audit_log FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert own company audit logs"
ON public.quote_audit_log FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 4) cut_plan_items: replace open UPDATE with company-scoped one
DROP POLICY IF EXISTS "Any authenticated user can update cut_plan_items" ON public.cut_plan_items;
CREATE POLICY "Company members can update cut_plan_items"
ON public.cut_plan_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.cut_plans cp
  WHERE cp.id = cut_plan_items.cut_plan_id
    AND cp.company_id = public.get_user_company_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.cut_plans cp
  WHERE cp.id = cut_plan_items.cut_plan_id
    AND cp.company_id = public.get_user_company_id(auth.uid())
));

-- 5) extract_rows: replace open UPDATE with company-scoped one
DROP POLICY IF EXISTS "Any authenticated user can update extract_rows" ON public.extract_rows;
CREATE POLICY "Company members can update extract_rows"
ON public.extract_rows FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()))
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 6) workspace_settings: scope SELECT/UPDATE by company
-- workspace_settings.company_id is text, get_user_company_id returns uuid
DROP POLICY IF EXISTS "Authenticated users can read workspace_settings" ON public.workspace_settings;
DROP POLICY IF EXISTS "Authenticated users can update workspace_settings" ON public.workspace_settings;

CREATE POLICY "Company members can read workspace_settings"
ON public.workspace_settings FOR SELECT TO authenticated
USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid())::text);

CREATE POLICY "Company members can update workspace_settings"
ON public.workspace_settings FOR UPDATE TO authenticated
USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid())::text)
WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid())::text);

-- 7) allowed_login_emails: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can read allowed emails" ON public.allowed_login_emails;
CREATE POLICY "Admins can read allowed emails"
ON public.allowed_login_emails FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
