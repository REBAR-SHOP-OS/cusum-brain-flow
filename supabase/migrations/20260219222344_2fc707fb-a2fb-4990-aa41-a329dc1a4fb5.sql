
-- Sync validation log for tracking data quality issues found during Odoo sync
CREATE TABLE public.sync_validation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  odoo_id TEXT NOT NULL,
  lead_id UUID,
  severity TEXT NOT NULL DEFAULT 'warning',
  validation_type TEXT NOT NULL,
  message TEXT NOT NULL,
  field_name TEXT,
  field_value TEXT,
  auto_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  fix_applied TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_validation_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can view sync validation logs"
  ON public.sync_validation_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND p.company_id = sync_validation_log.company_id
    )
  );

-- Validation trigger for severity and validation_type
CREATE OR REPLACE FUNCTION public.validate_sync_validation_log_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.severity NOT IN ('info', 'warning', 'error', 'critical') THEN
    RAISE EXCEPTION 'Invalid sync_validation_log severity: %', NEW.severity;
  END IF;
  IF NEW.validation_type NOT IN (
    'missing_field', 'anomaly', 'invalid_stage_transition', 'duplicate_detected',
    'zero_revenue_advanced', 'missing_contact_active', 'stale_lead', 'drift_detected', 'auto_fixed'
  ) THEN
    RAISE EXCEPTION 'Invalid sync_validation_log type: %', NEW.validation_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sync_validation_log
  BEFORE INSERT OR UPDATE ON public.sync_validation_log
  FOR EACH ROW EXECUTE FUNCTION validate_sync_validation_log_fields();

-- Index for quick lookups
CREATE INDEX idx_sync_validation_log_odoo_id ON public.sync_validation_log (odoo_id);
CREATE INDEX idx_sync_validation_log_severity ON public.sync_validation_log (severity);
CREATE INDEX idx_sync_validation_log_run ON public.sync_validation_log (sync_run_at DESC);
