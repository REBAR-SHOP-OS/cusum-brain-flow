-- Fix protect_profile_company_id to allow service_role (null auth.uid()) operations
CREATE OR REPLACE FUNCTION public.protect_profile_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip protection when called from service_role (no authenticated user)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If company_id is being changed and the user is not an admin, block it
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can change company assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix protect_profile_user_id to allow service_role (null auth.uid()) operations
CREATE OR REPLACE FUNCTION public.protect_profile_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip protection when called from service_role (no authenticated user)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can change user assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;