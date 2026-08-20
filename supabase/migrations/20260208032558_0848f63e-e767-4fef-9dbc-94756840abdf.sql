-- Fix: Restrict profile reads to same-company users only
-- Drop the overly permissive SELECT policy
DROP POLICY "Authenticated users can read profiles" ON public.profiles;

-- Users can only read profiles within their own company
CREATE POLICY "Users can read same-company profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
  );

-- Users should always be able to read their own profile (even if company_id not set yet)
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
  );