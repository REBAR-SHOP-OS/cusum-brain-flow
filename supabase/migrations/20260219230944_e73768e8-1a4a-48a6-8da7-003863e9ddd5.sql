
-- Pipeline webhooks configuration
CREATE TABLE public.pipeline_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view webhooks" ON public.pipeline_webhooks
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)::text);

CREATE POLICY "Admins can manage webhooks" ON public.pipeline_webhooks
  FOR ALL USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)::text
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Pipeline webhook delivery log
CREATE TABLE public.pipeline_webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.pipeline_webhooks(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view deliveries" ON public.pipeline_webhook_deliveries
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)::text);

-- Index for fast lookups
CREATE INDEX idx_pipeline_webhooks_company ON public.pipeline_webhooks(company_id);
CREATE INDEX idx_pipeline_webhook_deliveries_webhook ON public.pipeline_webhook_deliveries(webhook_id, created_at DESC);
