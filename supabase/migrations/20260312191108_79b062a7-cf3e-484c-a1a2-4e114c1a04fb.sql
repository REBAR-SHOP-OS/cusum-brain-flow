
-- Table for logging AI/LLM token usage
CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  agent_name text,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  company_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_created ON public.ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_provider ON public.ai_usage_log(provider);
CREATE INDEX idx_ai_usage_model ON public.ai_usage_log(model);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Only super admin can read (via authenticated); edge functions insert via service role
CREATE POLICY "Authenticated users can read ai_usage_log"
  ON public.ai_usage_log FOR SELECT TO authenticated USING (true);

-- RPC for aggregated summary
CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(days_back int DEFAULT 30)
RETURNS TABLE(
  provider text,
  model text,
  agent_name text,
  total_prompt_tokens bigint,
  total_completion_tokens bigint,
  total_total_tokens bigint,
  call_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.provider,
    a.model,
    COALESCE(a.agent_name, 'unknown') as agent_name,
    SUM(a.prompt_tokens)::bigint as total_prompt_tokens,
    SUM(a.completion_tokens)::bigint as total_completion_tokens,
    SUM(a.total_tokens)::bigint as total_total_tokens,
    COUNT(*)::bigint as call_count
  FROM public.ai_usage_log a
  WHERE a.created_at >= now() - (days_back || ' days')::interval
  GROUP BY a.provider, a.model, COALESCE(a.agent_name, 'unknown')
  ORDER BY total_total_tokens DESC;
$$;

-- Daily trend RPC
CREATE OR REPLACE FUNCTION public.get_ai_usage_daily(days_back int DEFAULT 30)
RETURNS TABLE(
  day date,
  provider text,
  total_tokens bigint,
  call_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.created_at::date as day,
    a.provider,
    SUM(a.total_tokens)::bigint as total_tokens,
    COUNT(*)::bigint as call_count
  FROM public.ai_usage_log a
  WHERE a.created_at >= now() - (days_back || ' days')::interval
  GROUP BY a.created_at::date, a.provider
  ORDER BY day;
$$;
