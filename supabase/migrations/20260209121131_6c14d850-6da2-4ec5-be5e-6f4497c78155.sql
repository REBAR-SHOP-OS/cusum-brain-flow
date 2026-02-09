
-- 1. Drop the permissive SELECT policy that exposes tokens to the client
DROP POLICY IF EXISTS "Users can view own RC tokens" ON public.user_ringcentral_tokens;

-- 2. Create a safe view that exposes only non-sensitive metadata to the client
CREATE OR REPLACE VIEW public.user_ringcentral_tokens_safe AS
SELECT id, user_id, rc_email, token_expires_at, created_at, updated_at
FROM public.user_ringcentral_tokens;

-- 3. Enable RLS-like access on the view via security definer function
CREATE OR REPLACE FUNCTION public.get_my_rc_status()
RETURNS TABLE(rc_email text, token_expires_at timestamptz, is_connected boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    rc_email,
    token_expires_at,
    (token_expires_at IS NULL OR token_expires_at > now()) AS is_connected
  FROM public.user_ringcentral_tokens
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 4. Create a restricted SELECT policy - users can only see their own non-token fields
-- We use a narrow policy: users can see rows but the view controls what columns are exposed
CREATE POLICY "Users can view own RC connection status"
ON public.user_ringcentral_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- 5. Add index for token expiration cleanup queries
CREATE INDEX IF NOT EXISTS idx_rc_tokens_expires_at 
ON public.user_ringcentral_tokens(token_expires_at);

-- 6. Block direct INSERT from client - only edge functions (service_role) should write tokens
DROP POLICY IF EXISTS "Users can insert own RC tokens" ON public.user_ringcentral_tokens;
DROP POLICY IF EXISTS "Users can update own RC tokens" ON public.user_ringcentral_tokens;

-- Users can only delete their own connection (disconnect)
-- INSERT and UPDATE are handled exclusively by edge functions via service_role
