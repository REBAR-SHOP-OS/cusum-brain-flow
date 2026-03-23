
-- Phase 2: Policy-driven routing tables

-- Provider configs
CREATE TABLE public.llm_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  priority int DEFAULT 10,
  max_rpm int,
  notes text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.llm_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read provider configs"
  ON public.llm_provider_configs FOR SELECT TO authenticated USING (true);

-- Routing policies
CREATE TABLE public.llm_routing_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text,
  message_pattern text,
  has_attachments boolean,
  provider text NOT NULL,
  model text NOT NULL,
  max_tokens int DEFAULT 4000,
  temperature numeric DEFAULT 0.5,
  priority int DEFAULT 100,
  is_active boolean DEFAULT true,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.llm_routing_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read routing policies"
  ON public.llm_routing_policy FOR SELECT TO authenticated USING (true);

-- Seed provider configs
INSERT INTO public.llm_provider_configs (provider, display_name, is_enabled, priority, notes) VALUES
  ('gemini', 'Google Gemini', true, 1, 'Primary provider — Pro for complex, Flash for default'),
  ('gpt', 'OpenAI GPT', true, 2, 'Secondary provider — used via fallback or explicit selection');

-- Seed routing policies mirroring current selectModel() rules
INSERT INTO public.llm_routing_policy (agent_name, message_pattern, has_attachments, provider, model, max_tokens, temperature, priority, reason) VALUES
  ('estimation', NULL, true, 'gemini', 'gemini-2.5-pro', 8000, 0.1, 10, 'estimation+docs'),
  (NULL, 'briefing|daily|report', NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 20, 'briefing context'),
  ('accounting', NULL, NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 30, 'complex reasoning → gemini-pro'),
  ('legal', NULL, NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 30, 'complex reasoning → gemini-pro'),
  ('empire', NULL, NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 30, 'complex reasoning → gemini-pro'),
  ('commander', NULL, NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 30, 'complex reasoning → gemini-pro'),
  ('data', NULL, NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 30, 'complex reasoning → gemini-pro'),
  (NULL, 'analyze|strategy|plan', NULL, 'gemini', 'gemini-2.5-pro', 6000, 0.2, 40, 'complex reasoning pattern'),
  (NULL, NULL, NULL, 'gemini', 'gemini-2.5-flash', 4000, 0.5, 999, 'default fast');
