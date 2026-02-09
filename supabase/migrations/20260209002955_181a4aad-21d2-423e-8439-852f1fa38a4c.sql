
-- 1. Drop the existing policy that exposes access_token to clients
DROP POLICY "Users can check own connection exists" ON public.user_meta_tokens;

-- 2. Block ALL direct client-side SELECT on the base table
-- Edge functions use service_role which bypasses RLS
CREATE POLICY "No direct client access to tokens"
  ON public.user_meta_tokens FOR SELECT
  USING (false);

-- 3. Create a safe view that excludes sensitive token data
-- Users can check their connection status without seeing tokens
CREATE OR REPLACE VIEW public.user_meta_tokens_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  user_id,
  platform,
  token_type,
  scopes,
  meta_user_id,
  meta_user_name,
  pages,
  instagram_accounts,
  expires_at,
  last_used_at,
  created_at,
  updated_at
FROM public.user_meta_tokens
WHERE user_id = auth.uid();

-- 4. Add RLS policy on base table to allow service-role writes only
-- (INSERT/UPDATE/DELETE already have no policies = denied by default with RLS on)
-- Edge functions bypass RLS via service_role, so no additional policies needed
