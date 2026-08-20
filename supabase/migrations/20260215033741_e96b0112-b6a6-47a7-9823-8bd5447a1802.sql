
-- =============================================
-- AI SEO Module: New Tables + Alter Existing
-- =============================================

-- 1. Alter seo_domains: add GA fields
ALTER TABLE public.seo_domains
  ADD COLUMN IF NOT EXISTS verified_ga BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ga_property_id TEXT;

-- 2. Alter seo_tasks: add AI fields
ALTER TABLE public.seo_tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS expected_impact TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- 3. Create seo_keyword_ai
CREATE TABLE public.seo_keyword_ai (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  intent TEXT DEFAULT 'informational',
  topic_cluster TEXT,
  impressions_28d INTEGER DEFAULT 0,
  clicks_28d INTEGER DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  avg_position NUMERIC(6,2),
  trend_score NUMERIC(6,2) DEFAULT 0, -- -100 to +100
  opportunity_score NUMERIC(5,2) DEFAULT 0, -- 0 to 100
  top_page TEXT,
  status TEXT DEFAULT 'opportunity', -- winner/stagnant/declining/opportunity
  last_analyzed_at TIMESTAMPTZ,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain_id, keyword)
);

-- Validation trigger for seo_keyword_ai
CREATE OR REPLACE FUNCTION public.validate_seo_keyword_ai_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.intent IS NOT NULL AND NEW.intent NOT IN ('informational','navigational','transactional','commercial') THEN
    RAISE EXCEPTION 'Invalid seo_keyword_ai intent: %', NEW.intent;
  END IF;
  IF NEW.status NOT IN ('winner','stagnant','declining','opportunity') THEN
    RAISE EXCEPTION 'Invalid seo_keyword_ai status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_seo_keyword_ai_trigger
  BEFORE INSERT OR UPDATE ON public.seo_keyword_ai
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_keyword_ai_fields();

ALTER TABLE public.seo_keyword_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view seo_keyword_ai for their company"
  ON public.seo_keyword_ai FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage seo_keyword_ai"
  ON public.seo_keyword_ai FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Create seo_page_ai
CREATE TABLE public.seo_page_ai (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  avg_position NUMERIC(6,2),
  sessions INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  speed_score NUMERIC(5,2),
  cwv_status TEXT DEFAULT 'unknown', -- good/needs_improvement/poor/unknown
  seo_score NUMERIC(5,2) DEFAULT 0, -- 0 to 100
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  last_analyzed_at TIMESTAMPTZ,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain_id, url)
);

CREATE OR REPLACE FUNCTION public.validate_seo_page_ai_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.cwv_status NOT IN ('good','needs_improvement','poor','unknown') THEN
    RAISE EXCEPTION 'Invalid cwv_status: %', NEW.cwv_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_seo_page_ai_trigger
  BEFORE INSERT OR UPDATE ON public.seo_page_ai
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_page_ai_fields();

ALTER TABLE public.seo_page_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view seo_page_ai for their company"
  ON public.seo_page_ai FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage seo_page_ai"
  ON public.seo_page_ai FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Create seo_insight
CREATE TABLE public.seo_insight (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- keyword/page
  entity_id UUID,
  insight_type TEXT NOT NULL, -- opportunity/risk/win/action
  explanation_text TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5, -- 0 to 1
  ai_payload_json JSONB DEFAULT '{}'::jsonb,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_seo_insight_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.entity_type NOT IN ('keyword','page') THEN
    RAISE EXCEPTION 'Invalid seo_insight entity_type: %', NEW.entity_type;
  END IF;
  IF NEW.insight_type NOT IN ('opportunity','risk','win','action') THEN
    RAISE EXCEPTION 'Invalid seo_insight insight_type: %', NEW.insight_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_seo_insight_trigger
  BEFORE INSERT OR UPDATE ON public.seo_insight
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_insight_fields();

ALTER TABLE public.seo_insight ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view seo_insight for their company"
  ON public.seo_insight FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage seo_insight"
  ON public.seo_insight FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Add indexes for performance
CREATE INDEX idx_seo_keyword_ai_domain ON public.seo_keyword_ai(domain_id);
CREATE INDEX idx_seo_keyword_ai_opportunity ON public.seo_keyword_ai(opportunity_score DESC);
CREATE INDEX idx_seo_keyword_ai_company ON public.seo_keyword_ai(company_id);
CREATE INDEX idx_seo_page_ai_domain ON public.seo_page_ai(domain_id);
CREATE INDEX idx_seo_page_ai_seo_score ON public.seo_page_ai(seo_score DESC);
CREATE INDEX idx_seo_page_ai_company ON public.seo_page_ai(company_id);
CREATE INDEX idx_seo_insight_domain ON public.seo_insight(domain_id);
CREATE INDEX idx_seo_insight_type ON public.seo_insight(insight_type);
CREATE INDEX idx_seo_insight_company ON public.seo_insight(company_id);
CREATE INDEX idx_seo_insight_entity ON public.seo_insight(entity_type, entity_id);
