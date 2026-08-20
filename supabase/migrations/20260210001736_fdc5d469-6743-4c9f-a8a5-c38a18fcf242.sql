
-- Remove the broad same-company SELECT policy that exposes all fields
DROP POLICY IF EXISTS "Users can read same-company profiles limited" ON public.profiles;

-- Non-admin users can only read their own raw profile
-- For coworker info, they must use the profiles_safe view which masks email/phone
-- Keep "Users can read own profile" as-is (already exists)

-- Add a restricted policy: non-admin staff can see basic coworker info (id, name, avatar, title)
-- but only through the profiles_safe view. For the raw table, limit to own profile only.
-- Since "Users can read own profile" already handles own-profile access,
-- we don't need another SELECT policy for non-admins on the raw table.

-- Admins need company-wide raw access for management
CREATE POLICY "Admins can read all company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND company_id = get_user_company_id(auth.uid())
);
