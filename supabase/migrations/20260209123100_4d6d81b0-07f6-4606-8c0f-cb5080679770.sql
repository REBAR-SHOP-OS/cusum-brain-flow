
-- Fix the audit trigger to handle service_role calls where auth.uid() is null
CREATE OR REPLACE FUNCTION public.audit_financial_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  _uid := auth.uid();
  
  -- Skip audit logging when called from service_role (no authenticated user)
  IF _uid IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD;
    ELSE RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (_uid, 'delete', OLD.entity_type, jsonb_build_object('quickbooks_id', OLD.quickbooks_id, 'balance', OLD.balance));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (_uid, 'update', NEW.entity_type, jsonb_build_object('quickbooks_id', NEW.quickbooks_id, 'old_balance', OLD.balance, 'new_balance', NEW.balance));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (_uid, 'insert', NEW.entity_type, jsonb_build_object('quickbooks_id', NEW.quickbooks_id, 'balance', NEW.balance));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
