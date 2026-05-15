CREATE OR REPLACE FUNCTION public._tmp_check_saurabh()
RETURNS TABLE(auth_id uuid, auth_email text, profile_id uuid, profile_user_id uuid, profile_company uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.email, p.id, p.user_id, p.company_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email ILIKE '%saurabh%';
$$;