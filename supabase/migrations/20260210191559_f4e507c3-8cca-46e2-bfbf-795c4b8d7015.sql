
-- 1. Deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- 2. Deny client INSERT on ringcentral tokens (service_role only)
CREATE POLICY "Deny client insert on rc tokens"
ON public.user_ringcentral_tokens
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- 3. Deny client UPDATE on ringcentral tokens (service_role only)
CREATE POLICY "Deny client update on rc tokens"
ON public.user_ringcentral_tokens
FOR UPDATE
TO authenticated, anon
USING (false);

-- 4. Deny client DELETE on ringcentral tokens (service_role only)
CREATE POLICY "Deny client delete on rc tokens"
ON public.user_ringcentral_tokens
FOR DELETE
TO authenticated, anon
USING (false);
