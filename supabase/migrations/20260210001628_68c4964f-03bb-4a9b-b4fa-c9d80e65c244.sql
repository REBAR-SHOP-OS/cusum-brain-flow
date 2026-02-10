
-- Deny all client access to rate_limit_entries (managed exclusively by SECURITY DEFINER functions)
CREATE POLICY "No direct client access"
ON public.rate_limit_entries
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
