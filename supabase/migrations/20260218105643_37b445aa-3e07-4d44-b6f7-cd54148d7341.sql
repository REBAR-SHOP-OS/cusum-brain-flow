
-- Per-field audit trail table
CREATE TABLE public.field_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company audit trail"
  ON public.field_audit_trail FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE INDEX idx_audit_trail_record ON public.field_audit_trail(table_name, record_id);
CREATE INDEX idx_audit_trail_time ON public.field_audit_trail(changed_at DESC);
CREATE INDEX idx_audit_trail_company ON public.field_audit_trail(company_id);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.track_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _company_id uuid;
  _col text;
  _old_val text;
  _new_val text;
  _skip_cols text[] := ARRAY['updated_at', 'created_at', 'id'];
BEGIN
  _uid := auth.uid();
  
  -- Try to get company_id from the record
  BEGIN
    EXECUTE format('SELECT ($1).%I::text', 'company_id') INTO _company_id USING NEW;
  EXCEPTION WHEN OTHERS THEN
    _company_id := NULL;
  END;

  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME
  LOOP
    IF _col = ANY(_skip_cols) THEN CONTINUE; END IF;

    EXECUTE format('SELECT ($1).%I::text', _col) INTO _old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', _col) INTO _new_val USING NEW;

    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.field_audit_trail (company_id, table_name, record_id, field_name, old_value, new_value, changed_by)
      VALUES (_company_id, TG_TABLE_NAME, OLD.id::text, _col, _old_val, _new_val, _uid);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach to key tables
CREATE TRIGGER audit_orders_field_changes
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();

CREATE TRIGGER audit_leads_field_changes
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();

CREATE TRIGGER audit_customers_field_changes
  AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();

CREATE TRIGGER audit_profiles_field_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.track_field_changes();
