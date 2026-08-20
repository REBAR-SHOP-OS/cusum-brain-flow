
-- S3: Remove the overly permissive ALL true policy on email_signatures
DROP POLICY IF EXISTS "Service role full access" ON public.email_signatures;

-- S5: Make profiles deny-anonymous policy RESTRICTIVE
DROP POLICY IF EXISTS "Deny anonymous access" ON public.profiles;
CREATE POLICY "Deny anonymous access" ON public.profiles
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (false);

-- S6: Scope admin profile delete by company_id
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- S6: Scope admin profile update by company_id
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- S7: Scope admin profile insert by company_id
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- S1: Create server-side PIN validation function (replaces hardcoded PIN in frontend)
CREATE OR REPLACE FUNCTION public.verify_admin_pin(_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can attempt PIN verification
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN false;
  END IF;
  -- PIN stored server-side, not in client code
  RETURN _pin = '7671';
END;
$$;
