
-- 1. Add company_id column
ALTER TABLE public.accounting_mirror
ADD COLUMN company_id uuid;

-- 2. Backfill existing rows: assign them to an existing company so they aren't orphaned
-- (use the first admin's company as fallback)
UPDATE public.accounting_mirror
SET company_id = (SELECT company_id FROM public.profiles WHERE company_id IS NOT NULL LIMIT 1)
WHERE company_id IS NULL;

-- 3. Make it NOT NULL now that backfill is done
ALTER TABLE public.accounting_mirror
ALTER COLUMN company_id SET NOT NULL;

-- 4. Drop all overly permissive policies
DROP POLICY "Authenticated users can read accounting_mirror" ON public.accounting_mirror;
DROP POLICY "Authenticated users can insert accounting_mirror" ON public.accounting_mirror;
DROP POLICY "Authenticated users can update accounting_mirror" ON public.accounting_mirror;
DROP POLICY "Authenticated users can delete accounting_mirror" ON public.accounting_mirror;

-- 5. Recreate with company + role restrictions (admin or accounting only)
CREATE POLICY "Admin/accounting can read own company financial data"
ON public.accounting_mirror
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);

CREATE POLICY "Admin/accounting can insert own company financial data"
ON public.accounting_mirror
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);

CREATE POLICY "Admin/accounting can update own company financial data"
ON public.accounting_mirror
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','accounting']::app_role[])
);

CREATE POLICY "Only admin can delete financial data"
ON public.accounting_mirror
FOR DELETE
TO authenticated
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
