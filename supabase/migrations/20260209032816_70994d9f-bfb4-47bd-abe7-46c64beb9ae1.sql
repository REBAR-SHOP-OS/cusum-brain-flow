
-- Create audit log table for financial data access
CREATE TABLE public.financial_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  record_count integer DEFAULT 1,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log
CREATE POLICY "Admins can read financial access log"
ON public.financial_access_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert is done via security definer function, no direct insert policy needed
-- but we need the trigger to insert rows

-- Audit trigger for all operations on accounting_mirror
CREATE OR REPLACE FUNCTION public.audit_financial_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (
      auth.uid(),
      'delete',
      OLD.entity_type,
      jsonb_build_object('quickbooks_id', OLD.quickbooks_id, 'balance', OLD.balance)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (
      auth.uid(),
      'update',
      NEW.entity_type,
      jsonb_build_object('quickbooks_id', NEW.quickbooks_id, 'old_balance', OLD.balance, 'new_balance', NEW.balance)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_access_log (user_id, action, entity_type, metadata)
    VALUES (
      auth.uid(),
      'insert',
      NEW.entity_type,
      jsonb_build_object('quickbooks_id', NEW.quickbooks_id, 'balance', NEW.balance)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_accounting_mirror_changes
AFTER INSERT OR UPDATE OR DELETE ON public.accounting_mirror
FOR EACH ROW
EXECUTE FUNCTION public.audit_financial_access();
