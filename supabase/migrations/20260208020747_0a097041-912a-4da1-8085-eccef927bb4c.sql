
-- Add company_id to customers table for multi-tenant scoping
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- Add company_id to contacts table for multi-tenant scoping
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- Backfill existing customers with the single known company
UPDATE public.customers SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- Backfill existing contacts with the single known company
UPDATE public.contacts SET company_id = 'a0000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- Drop existing contacts policies and recreate with company_id scoping
DROP POLICY IF EXISTS "Sales and accounting can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales and accounting can delete contacts" ON public.contacts;

-- Recreate with company_id filtering added
CREATE POLICY "Sales and accounting can read contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Sales and accounting can insert contacts"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Sales and accounting can update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Sales and accounting can delete contacts"
ON public.contacts FOR DELETE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','sales','accounting']::app_role[])
  AND (company_id IS NULL OR company_id = get_user_company_id(auth.uid()))
);
