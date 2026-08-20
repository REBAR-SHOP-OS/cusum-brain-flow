
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;

-- Create company-scoped policies
CREATE POLICY "Users can read customers in their company"
ON public.customers FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert customers in their company"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update customers in their company"
ON public.customers FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can delete customers in their company"
ON public.customers FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
);
