
-- =============================================
-- SUPPORT CHAT SYSTEM — Phase 1 Tables
-- =============================================

-- 1. Widget configuration per company
CREATE TABLE public.support_widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  widget_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  brand_name TEXT DEFAULT 'Support',
  brand_color TEXT DEFAULT '#6366f1',
  welcome_message TEXT DEFAULT 'Hi there! How can we help you today?',
  offline_message TEXT DEFAULT 'We''re currently offline. Leave a message and we''ll get back to you.',
  enabled BOOLEAN DEFAULT true,
  allowed_domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_widget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/office can manage widget configs"
  ON public.support_widget_configs FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid()));

-- 2. Support conversations
CREATE TABLE public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  widget_config_id UUID REFERENCES public.support_widget_configs(id),
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.profiles(id),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

-- Agents can see conversations for their company
CREATE POLICY "Agents can view support conversations"
  ON public.support_conversations FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Admin/office can manage (update assignment, status, etc.)
CREATE POLICY "Admin/office can manage support conversations"
  ON public.support_conversations FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
    AND company_id = public.get_user_company_id(auth.uid()));

-- Service role for edge functions (widget creates conversations)
CREATE POLICY "Service role full access to support conversations"
  ON public.support_conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_support_conversation_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'assigned', 'pending', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid support_conversation status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_support_conversation_status_trg
  BEFORE INSERT OR UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_conversation_status();

-- 3. Support messages
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'visitor',
  sender_id UUID,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  is_internal_note BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Agents can read messages for their company's conversations
CREATE POLICY "Agents can view support messages"
  ON public.support_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.support_conversations sc
    WHERE sc.id = conversation_id
      AND sc.company_id = public.get_user_company_id(auth.uid())
  ));

-- Agents can insert messages (replies)
CREATE POLICY "Agents can send support messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    sender_type = 'agent'
    AND sender_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM public.support_conversations sc
      WHERE sc.id = conversation_id
        AND sc.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Service role for widget-originated messages
CREATE POLICY "Service role full access to support messages"
  ON public.support_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Validation trigger for sender_type
CREATE OR REPLACE FUNCTION public.validate_support_message_fields()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.sender_type NOT IN ('visitor', 'agent', 'bot', 'system') THEN
    RAISE EXCEPTION 'Invalid support_message sender_type: %', NEW.sender_type;
  END IF;
  IF NEW.content_type NOT IN ('text', 'image', 'file', 'system') THEN
    RAISE EXCEPTION 'Invalid support_message content_type: %', NEW.content_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_support_message_fields_trg
  BEFORE INSERT OR UPDATE ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_message_fields();

-- Enable realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;

-- Indexes
CREATE INDEX idx_support_conversations_company ON public.support_conversations(company_id);
CREATE INDEX idx_support_conversations_status ON public.support_conversations(status);
CREATE INDEX idx_support_conversations_widget_key ON public.support_conversations(widget_config_id);
CREATE INDEX idx_support_messages_conversation ON public.support_messages(conversation_id);
CREATE INDEX idx_support_messages_created ON public.support_messages(created_at);

-- Updated_at triggers
CREATE TRIGGER update_support_widget_configs_updated_at
  BEFORE UPDATE ON public.support_widget_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
