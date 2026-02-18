
-- ============================================================
-- Phase 1: Alert Routing Engine — 3 new tables
-- ============================================================

-- 1. alert_routing_rules
CREATE TABLE public.alert_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  event_category text NOT NULL,
  event_type text,
  target_roles text[] NOT NULL DEFAULT '{}',
  channels text[] NOT NULL DEFAULT '{in_app}',
  priority text NOT NULL DEFAULT 'normal',
  escalate_to_role text,
  escalate_after_minutes integer NOT NULL DEFAULT 60,
  escalate_to_ceo_after_minutes integer,
  slack_channel text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage routing rules"
  ON public.alert_routing_rules FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Authenticated users can read routing rules"
  ON public.alert_routing_rules FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_alert_routing_rule()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.event_category NOT IN ('finance', 'sales', 'production', 'support', 'hr', 'system') THEN
    RAISE EXCEPTION 'Invalid event_category: %', NEW.event_category;
  END IF;
  IF NEW.priority NOT IN ('low', 'normal', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_alert_routing_rule
  BEFORE INSERT OR UPDATE ON public.alert_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.validate_alert_routing_rule();

-- 2. alert_escalation_queue
CREATE TABLE public.alert_escalation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.alert_routing_rules(id) ON DELETE CASCADE,
  escalation_level integer NOT NULL DEFAULT 0,
  escalate_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_escalation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company escalations"
  ON public.alert_escalation_queue FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage escalations"
  ON public.alert_escalation_queue FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_escalation_queue_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'escalated', 'acknowledged', 'resolved', 'expired') THEN
    RAISE EXCEPTION 'Invalid escalation status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_escalation_queue_status
  BEFORE INSERT OR UPDATE ON public.alert_escalation_queue
  FOR EACH ROW EXECUTE FUNCTION public.validate_escalation_queue_status();

-- 3. alert_dispatch_log
CREATE TABLE public.alert_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient_user_id uuid,
  recipient_address text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.alert_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company dispatch logs"
  ON public.alert_dispatch_log FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage dispatch logs"
  ON public.alert_dispatch_log FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Validation trigger for dispatch log
CREATE OR REPLACE FUNCTION public.validate_dispatch_log_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.channel NOT IN ('in_app', 'email', 'sms', 'slack') THEN
    RAISE EXCEPTION 'Invalid dispatch channel: %', NEW.channel;
  END IF;
  IF NEW.status NOT IN ('sent', 'delivered', 'failed', 'bounced') THEN
    RAISE EXCEPTION 'Invalid dispatch status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_dispatch_log_fields
  BEFORE INSERT OR UPDATE ON public.alert_dispatch_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_dispatch_log_fields();

-- Add phone_number column to profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone_number text;
  END IF;
END;
$$;

-- Enable realtime for escalation queue (for live countdowns)
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_escalation_queue;
