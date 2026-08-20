
-- #3: Delivery exception management.
-- Additive: new table + audit trigger. No changes to deliveries / delivery_bundles.

CREATE TABLE IF NOT EXISTS public.delivery_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL,
  delivery_id     uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  exception_type  text NOT NULL CHECK (exception_type IN ('hold','reject','failure')),
  reason          text NOT NULL,
  opened_by       uuid,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  resolved_by     uuid,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_exceptions_delivery
  ON public.delivery_exceptions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_exceptions_company_open
  ON public.delivery_exceptions(company_id) WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_exceptions TO authenticated;
GRANT ALL ON public.delivery_exceptions TO service_role;

ALTER TABLE public.delivery_exceptions ENABLE ROW LEVEL SECURITY;

-- Mirror the deliveries policy posture: staff in the same company (admin, office,
-- field, workshop) can read; admin/office/field/workshop can write.
CREATE POLICY "Delivery staff read exceptions"
  ON public.delivery_exceptions FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(
      auth.uid(),
      ARRAY['admin'::app_role,'office'::app_role,'field'::app_role,'workshop'::app_role]
    )
  );

CREATE POLICY "Delivery staff open exceptions"
  ON public.delivery_exceptions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(
      auth.uid(),
      ARRAY['admin'::app_role,'office'::app_role,'field'::app_role,'workshop'::app_role]
    )
  );

CREATE POLICY "Delivery staff update exceptions"
  ON public.delivery_exceptions FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_any_role(
      auth.uid(),
      ARRAY['admin'::app_role,'office'::app_role,'field'::app_role,'workshop'::app_role]
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
  );

CREATE POLICY "Admins delete exceptions"
  ON public.delivery_exceptions FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_delivery_exceptions_updated_at
  BEFORE UPDATE ON public.delivery_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger: log every exception open / resolve into activity_events.
CREATE OR REPLACE FUNCTION public.log_delivery_exception_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _actor  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'delivery_exception_opened';
    _actor  := NEW.opened_by;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL THEN
      _action := 'delivery_exception_resolved';
      _actor  := NEW.resolved_by;
    ELSIF OLD.resolved_at IS NOT NULL AND NEW.resolved_at IS NULL THEN
      _action := 'delivery_exception_reopened';
      _actor  := NEW.opened_by;
    ELSE
      _action := 'delivery_exception_updated';
      _actor  := COALESCE(NEW.resolved_by, NEW.opened_by);
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_events (
    company_id, entity_type, entity_id, event_type, description,
    source, actor_id, actor_type, metadata
  ) VALUES (
    NEW.company_id,
    'delivery',
    NEW.delivery_id::text,
    'audit',
    _action,
    'delivery_exception',
    _actor::text,
    'user',
    jsonb_build_object(
      'audit_action', _action,
      'exception_id', NEW.id,
      'exception_type', NEW.exception_type,
      'reason', NEW.reason,
      'resolution_note', NEW.resolution_note,
      'opened_by', NEW.opened_by,
      'opened_at', NEW.opened_at,
      'resolved_by', NEW.resolved_by,
      'resolved_at', NEW.resolved_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_delivery_exception_audit ON public.delivery_exceptions;
CREATE TRIGGER trg_log_delivery_exception_audit
AFTER INSERT OR UPDATE ON public.delivery_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.log_delivery_exception_audit();
