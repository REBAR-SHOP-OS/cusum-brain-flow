-- Drop overly permissive policies on quotes
DROP POLICY "Authenticated users can read quotes" ON public.quotes;
DROP POLICY "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY "Authenticated users can update quotes" ON public.quotes;
DROP POLICY "Authenticated users can delete quotes" ON public.quotes;

-- Restrict to admin, sales, accounting roles only
CREATE POLICY "Sales/Accounting/Admin can read quotes"
ON public.quotes FOR SELECT TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
);

CREATE POLICY "Sales/Accounting/Admin can insert quotes"
ON public.quotes FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
);

CREATE POLICY "Sales/Accounting/Admin can update quotes"
ON public.quotes FOR UPDATE TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
);

CREATE POLICY "Admin can delete quotes"
ON public.quotes FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);