
-- Add company_id column to employee_salaries
ALTER TABLE public.employee_salaries 
ADD COLUMN company_id uuid;

-- Backfill company_id from the linked profile
UPDATE public.employee_salaries es
SET company_id = p.company_id
FROM public.profiles p
WHERE es.profile_id = p.id;

-- Make company_id NOT NULL after backfill
ALTER TABLE public.employee_salaries 
ALTER COLUMN company_id SET NOT NULL;

-- Drop the old policy
DROP POLICY IF EXISTS "Only admins can manage salaries" ON public.employee_salaries;

-- Create company-scoped admin-only policies
CREATE POLICY "Admins can view salaries in their company"
ON public.employee_salaries FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can insert salaries in their company"
ON public.employee_salaries FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can update salaries in their company"
ON public.employee_salaries FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Admins can delete salaries in their company"
ON public.employee_salaries FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND company_id = public.get_user_company_id(auth.uid())
);
