
-- Track 1: RC Presence table
CREATE TABLE public.rc_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'Offline',
  dnd_status TEXT,
  telephony_status TEXT,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_rc_presence_user ON public.rc_presence (user_id);
ALTER TABLE public.rc_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read company presence" ON public.rc_presence FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Service role manages presence" ON public.rc_presence FOR ALL
  USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.rc_presence;

-- Track 5: SMS Templates table
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  variables TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read company templates" ON public.sms_templates FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can manage company templates" ON public.sms_templates FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company templates" ON public.sms_templates FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company templates" ON public.sms_templates FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Track 2/3: Index for voicemail/fax filtering on communications
CREATE INDEX idx_communications_source_metadata ON public.communications USING gin (metadata);
CREATE INDEX idx_communications_source ON public.communications (source);
