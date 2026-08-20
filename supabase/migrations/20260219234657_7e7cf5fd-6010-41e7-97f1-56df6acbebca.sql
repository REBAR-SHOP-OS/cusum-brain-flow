
-- ==============================================
-- Phase 15: notification_preferences table
-- ==============================================
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  company_id UUID NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME WITHOUT TIME ZONE,
  quiet_hours_end TIME WITHOUT TIME ZONE,
  muted_categories TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ==============================================
-- Phase 15: lead_score_history table
-- ==============================================
CREATE TABLE public.lead_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  win_probability NUMERIC,
  priority_score NUMERIC,
  score_factors JSONB DEFAULT '{}',
  model_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_score_history_lead_date ON public.lead_score_history (lead_id, created_at DESC);
CREATE INDEX idx_lead_score_history_company ON public.lead_score_history (company_id);

ALTER TABLE public.lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read lead score history for their company"
  ON public.lead_score_history FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert lead score history for their company"
  ON public.lead_score_history FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- ==============================================
-- Phase 15: lead_communications table
-- ==============================================
CREATE TABLE public.lead_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  comm_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  contact_name TEXT,
  contact_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_communications_lead_date ON public.lead_communications (lead_id, created_at DESC);
CREATE INDEX idx_lead_communications_company ON public.lead_communications (company_id);

ALTER TABLE public.lead_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read lead communications for their company"
  ON public.lead_communications FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert lead communications for their company"
  ON public.lead_communications FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update lead communications for their company"
  ON public.lead_communications FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete lead communications for their company"
  ON public.lead_communications FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Validation trigger for lead_communications
CREATE OR REPLACE FUNCTION public.validate_lead_communication_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.comm_type NOT IN ('email', 'call', 'meeting', 'note', 'sms') THEN
    RAISE EXCEPTION 'Invalid comm_type: %', NEW.comm_type;
  END IF;
  IF NEW.direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'Invalid direction: %', NEW.direction;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_lead_communication_fields_trigger
  BEFORE INSERT OR UPDATE ON public.lead_communications
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_communication_fields();
