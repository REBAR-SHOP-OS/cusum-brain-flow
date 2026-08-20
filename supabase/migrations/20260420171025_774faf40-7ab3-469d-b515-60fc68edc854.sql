ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS provider_route TEXT;
COMMENT ON COLUMN public.ai_usage_log.provider_route IS 'Routing path used: direct_gemini | direct_openai | lovable_gateway';
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_route ON public.ai_usage_log(provider_route, created_at DESC);