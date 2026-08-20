INSERT INTO public.user_roles (user_id, role)
VALUES ('c9b3adc2-5632-47d2-bfa3-4b6a781a9607', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;