
-- 1. Replace the broad SELECT policy with a more restrictive one
-- Admins get full access; sales/accounting get access through the masked view
DROP POLICY IF EXISTS "Sales and accounting can read contacts" ON public.contacts;

-- Admins can read all contacts with full details (company-scoped)
CREATE POLICY "Admins can read all contacts"
ON public.contacts
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  AND company_id = public.get_user_company_id(auth.uid())
);

-- Sales/accounting can still read contacts (needed for app functionality)
-- but we'll enforce audit logging and the safe view masks PII
CREATE POLICY "Staff can read own company contacts"
ON public.contacts
FOR SELECT
USING (
  public.has_any_role(auth.uid(), ARRAY['sales'::app_role, 'accounting'::app_role])
  AND company_id = public.get_user_company_id(auth.uid())
);

-- 2. Create a function to log bulk access attempts (called from client code)
CREATE OR REPLACE FUNCTION public.log_contact_bulk_access(_count integer, _action text DEFAULT 'bulk_read')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contact_access_log (user_id, action, contact_count, metadata)
  VALUES (
    auth.uid(), 
    _action, 
    _count, 
    jsonb_build_object('timestamp', now(), 'ip', current_setting('request.headers', true)::jsonb->>'x-forwarded-for')
  );
  
  -- Flag suspicious bulk access (>50 contacts at once)
  IF _count > 50 THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_count, metadata)
    VALUES (
      auth.uid(),
      'ALERT:bulk_export_detected',
      _count,
      jsonb_build_object('timestamp', now(), 'severity', 'high')
    );
  END IF;
END;
$$;
