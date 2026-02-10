-- Block all client-side SELECT on raw token table
DROP POLICY IF EXISTS "Users can view own RC connection status" ON public.user_ringcentral_tokens;

-- Replace with a deny-all SELECT policy (tokens accessed only via service_role in edge functions)
-- The get_my_rc_status() SECURITY DEFINER function provides safe status checks
CREATE POLICY "No direct token reads"
ON public.user_ringcentral_tokens
FOR SELECT
TO authenticated
USING (false);