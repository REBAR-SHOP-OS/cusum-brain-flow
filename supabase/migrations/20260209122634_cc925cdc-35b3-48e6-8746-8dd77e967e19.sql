
ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_company_id_trigger;

UPDATE public.profiles 
SET company_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE user_id = 'c612f0e6-41bd-4775-9ce2-f57aeb20bdb2';

ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_company_id_trigger;
