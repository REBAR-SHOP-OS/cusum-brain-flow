
-- Fix audit_contact_changes to handle service_role calls (null auth.uid())
CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  _uid := auth.uid();
  
  -- Skip audit when called from service_role (no authenticated user)
  IF _uid IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD;
    ELSE RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (_uid, 'delete', OLD.id, jsonb_build_object('name', OLD.first_name || ' ' || COALESCE(OLD.last_name, '')));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (_uid, 'update', NEW.id, jsonb_build_object('name', NEW.first_name || ' ' || COALESCE(NEW.last_name, '')));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (_uid, 'insert', NEW.id, jsonb_build_object('name', NEW.first_name || ' ' || COALESCE(NEW.last_name, '')));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
