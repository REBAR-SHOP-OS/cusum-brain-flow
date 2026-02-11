
-- Table 1: comms_agent_pairing
CREATE TABLE public.comms_agent_pairing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text UNIQUE NOT NULL,
  agent_name text NOT NULL,
  rc_extension text,
  draft_only boolean NOT NULL DEFAULT false,
  company_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comms_agent_pairing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pairings"
  ON public.comms_agent_pairing FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage pairings"
  ON public.comms_agent_pairing FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Seed pairings
INSERT INTO public.comms_agent_pairing (user_email, agent_name, rc_extension, draft_only) VALUES
  ('saurabh@rebar.shop', 'Blitz', 'ext206', false),
  ('neel@rebar.shop', 'Blitz', 'ext209', false),
  ('radin@rebar.shop', 'Relay', 'ext222', true),
  ('vicky@rebar.shop', 'Penny', 'ext201', false),
  ('ben@rebar.shop', 'Gauge', 'ext203', false),
  ('sattar@rebar.shop', 'Vizzy', 'ext101', false),
  ('kourosh@rebar.shop', 'Forge', NULL, false),
  ('josh@rebar.shop', 'Vizzy', 'ext202', false);

-- Table 2: comms_config
CREATE TABLE public.comms_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  external_sender text NOT NULL DEFAULT 'rfq@rebar.shop',
  internal_sender text NOT NULL DEFAULT 'ai@rebar.shop',
  internal_domain text NOT NULL DEFAULT 'rebar.shop',
  response_thresholds_hours jsonb NOT NULL DEFAULT '[2, 4, 24]'::jsonb,
  missed_call_alert text NOT NULL DEFAULT 'instant',
  daily_brief_time text NOT NULL DEFAULT '08:00',
  brief_recipients text[] NOT NULL DEFAULT '{ai@rebar.shop}',
  no_act_global boolean NOT NULL DEFAULT true,
  ceo_email text NOT NULL DEFAULT 'sattar@rebar.shop',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comms_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config"
  ON public.comms_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage config"
  ON public.comms_config FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Seed default config
INSERT INTO public.comms_config (company_id) VALUES ('a0000000-0000-0000-0000-000000000001'::uuid);

-- Table 3: comms_alerts
CREATE TABLE public.comms_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  communication_id uuid REFERENCES public.communications(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  owner_notified_at timestamptz,
  ceo_notified_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb,
  company_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comms_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read alerts"
  ON public.comms_alerts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service can manage alerts"
  ON public.comms_alerts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- Validation trigger for alert_type
CREATE OR REPLACE FUNCTION public.validate_comms_alert_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.alert_type NOT IN ('response_time_2h', 'response_time_4h', 'response_time_24h', 'missed_call') THEN
    RAISE EXCEPTION 'Invalid alert_type: %', NEW.alert_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_comms_alert_type
  BEFORE INSERT OR UPDATE ON public.comms_alerts
  FOR EACH ROW EXECUTE FUNCTION public.validate_comms_alert_type();

-- Updated_at trigger for comms_config
CREATE TRIGGER trg_comms_config_updated_at
  BEFORE UPDATE ON public.comms_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for alert dedup
CREATE INDEX idx_comms_alerts_dedup ON public.comms_alerts (communication_id, alert_type);
