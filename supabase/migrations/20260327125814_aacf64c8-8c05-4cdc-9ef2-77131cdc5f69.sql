
DROP POLICY IF EXISTS "Users can view own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can view own company invoice items" ON sales_invoice_items
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can update own company invoice items" ON sales_invoice_items
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can delete own company invoice items" ON sales_invoice_items
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
