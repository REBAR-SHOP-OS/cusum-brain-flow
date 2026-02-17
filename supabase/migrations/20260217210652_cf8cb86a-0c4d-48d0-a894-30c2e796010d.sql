
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe AS
SELECT id, user_id, full_name, title, department, duties, email, avatar_url, is_active, preferred_language, manager_id, created_at, updated_at
FROM public.profiles;
