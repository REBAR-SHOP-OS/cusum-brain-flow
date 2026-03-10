DELETE FROM public.user_roles
WHERE user_id = (
  SELECT user_id FROM public.profiles WHERE email = 'ai@rebar.shop'
)
AND role = 'admin';