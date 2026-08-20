
-- 1. Add company_id column to orders
ALTER TABLE public.orders
ADD COLUMN company_id uuid;

-- 2. Backfill company_id from customers
UPDATE public.orders o
SET company_id = c.company_id
FROM public.customers c
WHERE o.customer_id = c.id
  AND c.company_id IS NOT NULL;

-- 3. Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;

-- 4. Create company-scoped RLS policies
CREATE POLICY "Users can read own company orders"
ON public.orders FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert own company orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update own company orders"
ON public.orders FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can delete own company orders"
ON public.orders FOR DELETE
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);
