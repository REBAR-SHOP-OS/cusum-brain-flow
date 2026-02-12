
-- Re-apply Priority 1 & 2 (rolled back by first migration failure)

-- Priority 1: Lock down profiles.company_id
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND company_id = (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
);

-- Priority 2: Remove employee self-access to employee_salaries
DROP POLICY IF EXISTS "Users can view own salary" ON public.employee_salaries;

-- Attach audit trigger
DROP TRIGGER IF EXISTS trg_audit_salary_access ON public.employee_salaries;
CREATE TRIGGER trg_audit_salary_access
  AFTER INSERT OR UPDATE ON public.employee_salaries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_salary_access();

-- Ensure read policy exists for shape-schematics storage
DROP POLICY IF EXISTS "Authenticated users can read shape schematics" ON storage.objects;
CREATE POLICY "Authenticated users can read shape schematics"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'shape-schematics');
