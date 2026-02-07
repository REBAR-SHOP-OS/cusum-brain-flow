
-- Suggestion tracking for the intelligence engine
CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'rebar-shop',
  suggestion_type TEXT NOT NULL, -- 'next_action', 'warning', 'optimization', 'learning'
  category TEXT NOT NULL, -- 'production', 'inventory', 'delivery', 'quality', 'scheduling'
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 50, -- 0-100
  context JSONB DEFAULT '{}', -- related entity ids, machine states, etc
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'shown', 'accepted', 'ignored', 'dismissed'
  shown_to UUID REFERENCES auth.users(id),
  shown_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suggestions"
  ON public.suggestions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System can insert suggestions"
  ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update suggestion status"
  ON public.suggestions FOR UPDATE TO authenticated
  USING (true);

-- Command log for free-text commands
CREATE TABLE public.command_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  raw_input TEXT NOT NULL,
  parsed_intent TEXT,
  parsed_params JSONB DEFAULT '{}',
  result TEXT, -- 'executed', 'denied', 'failed', 'suggested_alternative'
  result_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.command_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own commands"
  ON public.command_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert commands"
  ON public.command_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on suggestions
CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
