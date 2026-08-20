-- Security: replace email-based social access with role-based checks (admin + marketing).
-- Grants existing social team emails the `marketing` role so behavior matches prior is_social_team() list.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketing';

CREATE OR REPLACE FUNCTION public.is_social_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(
    auth.uid(),
    ARRAY['admin'::public.app_role, 'marketing'::public.app_role]
  );
$$;

-- Backfill: same individuals who were hardcoded in the old is_social_team()
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'marketing'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN (
  'radin@rebar.shop',
  'zahra@rebar.shop',
  'neel@rebar.shop'
)
ON CONFLICT (user_id, role) DO NOTHING;
