-- Fix 1: Drop and recreate profiles_safe view without phone column
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
  SELECT id, user_id, full_name, title, department, duties,
         email, avatar_url, is_active, preferred_language,
         employee_type, created_at, updated_at
  FROM public.profiles;

-- Fix 2: Add explicit deny-all SELECT policy on user_gmail_tokens
CREATE POLICY "No direct token reads"
  ON public.user_gmail_tokens
  FOR SELECT
  TO authenticated, anon
  USING (false);