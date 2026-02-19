
-- 1. Fix profiles_safe: add company filter + SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, full_name, title, department, duties, email, avatar_url,
       is_active, preferred_language, manager_id, created_at, updated_at
FROM public.profiles
WHERE company_id = public.get_user_company_id(auth.uid());

-- 2. Fix contacts_safe: SECURITY INVOKER
DROP VIEW IF EXISTS public.contacts_safe;
CREATE VIEW public.contacts_safe
WITH (security_invoker = true)
AS
SELECT id, customer_id, first_name, last_name,
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN email
    WHEN email IS NOT NULL THEN concat('***', substring(email from position('@' in email)))
    ELSE NULL::text
  END AS email,
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN phone
    WHEN phone IS NOT NULL THEN concat('***-***-', right(phone, 4))
    ELSE NULL::text
  END AS phone,
  role, is_primary, created_at, updated_at, company_id
FROM public.contacts;

-- 3. Fix user_meta_tokens_safe: SECURITY INVOKER
DROP VIEW IF EXISTS public.user_meta_tokens_safe;
CREATE VIEW public.user_meta_tokens_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, platform, token_type, scopes, meta_user_id, meta_user_name,
       pages, instagram_accounts, expires_at, last_used_at, created_at, updated_at
FROM public.user_meta_tokens
WHERE user_id = auth.uid();

-- 4. Fix events: SECURITY INVOKER
DROP VIEW IF EXISTS public.events;
CREATE VIEW public.events
WITH (security_invoker = true)
AS
SELECT id, event_type, entity_type, entity_id, actor_type, actor_id,
       description, metadata, created_at, company_id, source, dedupe_key,
       inputs_snapshot, processed_at
FROM public.activity_events;

-- 5. Lock OAuth token tables
DROP POLICY IF EXISTS "No direct token reads" ON public.user_gmail_tokens;
DROP POLICY IF EXISTS "Users can insert their own gmail token" ON public.user_gmail_tokens;
DROP POLICY IF EXISTS "Users can update their own gmail token" ON public.user_gmail_tokens;

CREATE POLICY "Deny all client select" ON public.user_gmail_tokens FOR SELECT TO authenticated USING (false);
CREATE POLICY "Deny all client insert" ON public.user_gmail_tokens FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny all client update" ON public.user_gmail_tokens FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny all client delete" ON public.user_gmail_tokens FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "Users can delete own RC tokens" ON public.user_ringcentral_tokens;
CREATE POLICY "Deny all client delete clean" ON public.user_ringcentral_tokens FOR DELETE TO authenticated USING (false);

CREATE POLICY "Deny all client insert" ON public.user_meta_tokens FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny all client update" ON public.user_meta_tokens FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny all client delete" ON public.user_meta_tokens FOR DELETE TO authenticated USING (false);

-- 6. Create get_my_gmail_status() (corrected: no token_expires_at column)
CREATE OR REPLACE FUNCTION public.get_my_gmail_status()
RETURNS TABLE(gmail_email text, is_connected boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gmail_email,
    true AS is_connected
  FROM public.user_gmail_tokens
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
