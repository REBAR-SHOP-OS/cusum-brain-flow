-- Fix the broken insert RLS policy on sales_invoice_items
-- Current: profiles.id = auth.uid() (wrong - profiles.id is a UUID primary key, not the user_id)
-- Fixed:  profiles.user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert own company invoice items" ON public.sales_invoice_items;

CREATE POLICY "Users can insert own company invoice items"
ON public.sales_invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT profiles.company_id
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);