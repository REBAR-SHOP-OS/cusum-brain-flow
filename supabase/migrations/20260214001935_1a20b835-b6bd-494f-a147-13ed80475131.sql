
-- ============================================================
-- Email Marketing Manager: Phase 1 — Database Foundation
-- ============================================================

-- 1. email_campaigns
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'newsletter',
  status text NOT NULL DEFAULT 'draft',
  subject_line text,
  preview_text text,
  body_html text,
  body_text text,
  segment_rules jsonb DEFAULT '{}'::jsonb,
  estimated_recipients integer DEFAULT 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office+ can view campaigns"
  ON public.email_campaigns FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can insert campaigns"
  ON public.email_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can update campaigns"
  ON public.email_campaigns FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Admin can delete campaigns"
  ON public.email_campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for campaign status
CREATE OR REPLACE FUNCTION public.validate_email_campaign_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('draft','pending_approval','approved','sending','sent','paused','canceled') THEN
    RAISE EXCEPTION 'Invalid email_campaign status: %', NEW.status;
  END IF;
  IF NEW.campaign_type NOT IN ('nurture','follow_up','newsletter','winback','announcement') THEN
    RAISE EXCEPTION 'Invalid campaign_type: %', NEW.campaign_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_email_campaign
  BEFORE INSERT OR UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_email_campaign_status();

-- Auto-update updated_at
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 2. email_campaign_sends
CREATE TABLE public.email_campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office+ can view sends"
  ON public.email_campaign_sends FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can insert sends"
  ON public.email_campaign_sends FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can update sends"
  ON public.email_campaign_sends FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

-- Validation trigger for send status
CREATE OR REPLACE FUNCTION public.validate_email_send_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('queued','sent','delivered','opened','clicked','bounced','complained','unsubscribed') THEN
    RAISE EXCEPTION 'Invalid email_campaign_send status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_email_send
  BEFORE INSERT OR UPDATE ON public.email_campaign_sends
  FOR EACH ROW EXECUTE FUNCTION public.validate_email_send_status();

-- Index for fast campaign lookups
CREATE INDEX idx_email_campaign_sends_campaign ON public.email_campaign_sends(campaign_id);


-- 3. email_suppressions
CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'manual',
  source text,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office+ can view suppressions"
  ON public.email_suppressions FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can insert suppressions"
  ON public.email_suppressions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Admin can delete suppressions"
  ON public.email_suppressions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validation trigger for suppression reason
CREATE OR REPLACE FUNCTION public.validate_suppression_reason()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.reason NOT IN ('unsubscribe','bounce','complaint','manual') THEN
    RAISE EXCEPTION 'Invalid suppression reason: %', NEW.reason;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_suppression
  BEFORE INSERT OR UPDATE ON public.email_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.validate_suppression_reason();


-- 4. email_consent_events (append-only audit trail)
CREATE TABLE public.email_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id),
  email text NOT NULL,
  consent_type text NOT NULL DEFAULT 'marketing_email',
  status text NOT NULL DEFAULT 'granted',
  source text NOT NULL DEFAULT 'manual',
  evidence jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  company_id uuid NOT NULL
);

ALTER TABLE public.email_consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office+ can view consent events"
  ON public.email_consent_events FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

CREATE POLICY "Office+ can insert consent events"
  ON public.email_consent_events FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office','sales']::app_role[]));

-- No UPDATE/DELETE for non-admins (append-only)
CREATE POLICY "Admin can update consent events"
  ON public.email_consent_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Validation
CREATE OR REPLACE FUNCTION public.validate_consent_event()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.consent_type NOT IN ('marketing_email','transactional') THEN
    RAISE EXCEPTION 'Invalid consent_type: %', NEW.consent_type;
  END IF;
  IF NEW.status NOT IN ('granted','revoked') THEN
    RAISE EXCEPTION 'Invalid consent status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_consent
  BEFORE INSERT OR UPDATE ON public.email_consent_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_consent_event();
