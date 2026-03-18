
DROP POLICY IF EXISTS "Users can view purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY IF EXISTS "Users can insert purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY IF EXISTS "Users can update purchasing items in their company" ON public.purchasing_list_items;
DROP POLICY IF EXISTS "Users can delete purchasing items in their company" ON public.purchasing_list_items;

CREATE POLICY "Users can view purchasing items in their company"
ON public.purchasing_list_items FOR SELECT
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can insert purchasing items in their company"
ON public.purchasing_list_items FOR INSERT
WITH CHECK (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can update purchasing items in their company"
ON public.purchasing_list_items FOR UPDATE
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Users can delete purchasing items in their company"
ON public.purchasing_list_items FOR DELETE
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));
