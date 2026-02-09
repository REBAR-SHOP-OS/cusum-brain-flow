
-- 1. Create audit log table for sensitive data access
CREATE TABLE public.contact_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'select', 'insert', 'update', 'delete', 'bulk_export'
  contact_id UUID,
  contact_count INT DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS - only admins can read audit logs
ALTER TABLE public.contact_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view contact audit logs"
  ON public.contact_access_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow inserts from the logging function (security definer)
CREATE POLICY "System can insert audit logs"
  ON public.contact_access_log FOR INSERT
  WITH CHECK (true);

-- 2. Create function to log contact access
CREATE OR REPLACE FUNCTION public.log_contact_access(
  _action TEXT,
  _contact_id UUID DEFAULT NULL,
  _contact_count INT DEFAULT 1,
  _metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contact_access_log (user_id, action, contact_id, contact_count, metadata)
  VALUES (auth.uid(), _action, _contact_id, _contact_count, _metadata);
END;
$$;

-- 3. Create a secure view that masks PII for non-admin users
-- Sales/accounting see last 4 chars of email and masked phone
CREATE OR REPLACE VIEW public.contacts_safe
WITH (security_invoker = on)
AS
SELECT
  id,
  customer_id,
  first_name,
  last_name,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN email
    WHEN email IS NOT NULL THEN
      CONCAT('***', SUBSTRING(email FROM POSITION('@' IN email)))
    ELSE NULL
  END AS email,
  CASE
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN phone
    WHEN phone IS NOT NULL THEN
      CONCAT('***-***-', RIGHT(phone, 4))
    ELSE NULL
  END AS phone,
  role,
  is_primary,
  created_at,
  updated_at,
  company_id
FROM public.contacts;

-- 4. Add trigger to audit contact modifications (insert/update/delete)
CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (auth.uid(), 'delete', OLD.id, jsonb_build_object('name', OLD.first_name || ' ' || COALESCE(OLD.last_name, '')));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (auth.uid(), 'update', NEW.id, jsonb_build_object('name', NEW.first_name || ' ' || COALESCE(NEW.last_name, '')));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.contact_access_log (user_id, action, contact_id, metadata)
    VALUES (auth.uid(), 'insert', NEW.id, jsonb_build_object('name', NEW.first_name || ' ' || COALESCE(NEW.last_name, '')));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_contact_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_contact_changes();

-- 5. Index for efficient audit log queries
CREATE INDEX idx_contact_access_log_user_date ON public.contact_access_log (user_id, created_at DESC);
CREATE INDEX idx_contact_access_log_action ON public.contact_access_log (action, created_at DESC);
