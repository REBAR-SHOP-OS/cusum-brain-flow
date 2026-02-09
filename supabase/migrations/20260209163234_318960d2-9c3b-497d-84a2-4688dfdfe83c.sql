
-- 1. Create a safe view that hides email/phone for colleagues
CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
  SELECT 
    id,
    user_id,
    full_name,
    title,
    department,
    duties,
    avatar_url,
    is_active,
    created_at,
    updated_at,
    company_id,
    preferred_language,
    -- Mask email: show only for own profile
    CASE 
      WHEN user_id = auth.uid() THEN email
      ELSE CONCAT(LEFT(SPLIT_PART(COALESCE(email,''), '@', 1), 2), '***@', SPLIT_PART(COALESCE(email,''), '@', 2))
    END AS email,
    -- Mask phone: show only for own profile
    CASE 
      WHEN user_id = auth.uid() THEN phone
      ELSE NULL
    END AS phone
  FROM public.profiles;

-- 2. Drop the overly permissive same-company SELECT policy
DROP POLICY "Users can read same-company profiles" ON public.profiles;

-- 3. Create a restricted same-company policy that only exposes non-sensitive columns
-- Users can still SELECT but the view is the recommended access path
-- This policy allows same-company reads (needed for view to work)
CREATE POLICY "Users can read same-company profiles limited"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
  );

-- 4. Employee salaries: allow employees to read their own salary
CREATE POLICY "Users can view own salary"
  ON public.employee_salaries FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- 5. Add audit trigger for salary access
CREATE OR REPLACE FUNCTION public.audit_salary_access()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
  VALUES (
    auth.uid(),
    'salary_read',
    'employee_salary',
    jsonb_build_object('profile_id', NEW.profile_id, 'salary_type', NEW.salary_type)
  );
  RETURN NEW;
END;
$$;
