
-- Phase 3: Provider Subsystem Hardening

-- 1. Add health columns to llm_provider_configs
ALTER TABLE public.llm_provider_configs 
  ADD COLUMN IF NOT EXISTS last_health_check timestamptz,
  ADD COLUMN IF NOT EXISTS is_healthy boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_latency_ms int;

-- 2. Add estimated_cost_usd to ai_execution_log
ALTER TABLE public.ai_execution_log
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric;

-- 3. Create llm_provider_pricing table
CREATE TABLE IF NOT EXISTS public.llm_provider_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  prompt_cost_per_1m numeric NOT NULL,
  completion_cost_per_1m numeric NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, model)
);

ALTER TABLE public.llm_provider_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pricing"
  ON public.llm_provider_pricing FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role full access to pricing"
  ON public.llm_provider_pricing FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Seed pricing data
INSERT INTO public.llm_provider_pricing (provider, model, prompt_cost_per_1m, completion_cost_per_1m) VALUES
  ('gemini', 'gemini-2.5-pro', 1.25, 10),
  ('gemini', 'gemini-2.5-flash', 0.15, 0.6),
  ('gpt', 'gpt-4o', 2.5, 10),
  ('gpt', 'gpt-4o-mini', 0.15, 0.6),
  ('gpt', 'gpt-5', 10, 30)
ON CONFLICT (provider, model) DO NOTHING;

-- 4. Create llm_company_budget table
CREATE TABLE IF NOT EXISTS public.llm_company_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL UNIQUE,
  monthly_budget_usd numeric DEFAULT 100,
  alert_threshold_pct numeric DEFAULT 80,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.llm_company_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read budgets"
  ON public.llm_company_budget FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role full access to budgets"
  ON public.llm_company_budget FOR ALL
  TO service_role USING (true) WITH CHECK (true);
