
-- ============================================================
-- Rebar SEO Module — 7 tables + RLS + validation triggers
-- ============================================================

-- 1. seo_domains
CREATE TABLE public.seo_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  gsc_verified BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_domains_select" ON public.seo_domains FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_domains_insert" ON public.seo_domains FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE POLICY "seo_domains_update" ON public.seo_domains FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE POLICY "seo_domains_delete" ON public.seo_domains FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_seo_domains_updated_at BEFORE UPDATE ON public.seo_domains
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. seo_keywords
CREATE TABLE public.seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  target_url TEXT,
  country TEXT NOT NULL DEFAULT 'AU',
  device TEXT NOT NULL DEFAULT 'desktop',
  intent TEXT DEFAULT 'informational',
  tags TEXT[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_keywords_select" ON public.seo_keywords FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_keywords_insert" ON public.seo_keywords FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE POLICY "seo_keywords_update" ON public.seo_keywords FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE POLICY "seo_keywords_delete" ON public.seo_keywords FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE OR REPLACE FUNCTION public.validate_seo_keyword_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.device NOT IN ('desktop','mobile','tablet') THEN
    RAISE EXCEPTION 'Invalid seo_keyword device: %', NEW.device;
  END IF;
  IF NEW.intent IS NOT NULL AND NEW.intent NOT IN ('informational','navigational','transactional','commercial') THEN
    RAISE EXCEPTION 'Invalid seo_keyword intent: %', NEW.intent;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_seo_keyword BEFORE INSERT OR UPDATE ON public.seo_keywords
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_keyword_fields();

-- 3. seo_rank_history
CREATE TABLE public.seo_rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  position NUMERIC,
  url_found TEXT,
  source TEXT NOT NULL DEFAULT 'gsc',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(keyword_id, date, source)
);
ALTER TABLE public.seo_rank_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_rank_history_select" ON public.seo_rank_history FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_rank_history_insert" ON public.seo_rank_history FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE INDEX idx_seo_rank_history_keyword_date ON public.seo_rank_history(keyword_id, date DESC);

-- 4. seo_crawl_runs
CREATE TABLE public.seo_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  pages_crawled INTEGER DEFAULT 0,
  health_score NUMERIC DEFAULT 0,
  issues_critical INTEGER DEFAULT 0,
  issues_warning INTEGER DEFAULT 0,
  issues_info INTEGER DEFAULT 0,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.seo_crawl_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_crawl_runs_select" ON public.seo_crawl_runs FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_crawl_runs_insert" ON public.seo_crawl_runs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_crawl_runs_update" ON public.seo_crawl_runs FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_seo_crawl_run_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('running','completed','failed') THEN
    RAISE EXCEPTION 'Invalid seo_crawl_run status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_seo_crawl_run BEFORE INSERT OR UPDATE ON public.seo_crawl_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_crawl_run_status();

-- 5. seo_crawl_pages
CREATE TABLE public.seo_crawl_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES public.seo_crawl_runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status_code INTEGER,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  canonical TEXT,
  robots_directives TEXT,
  in_sitemap BOOLEAN DEFAULT false,
  redirect_target TEXT,
  word_count INTEGER DEFAULT 0,
  load_time_ms INTEGER,
  issues_json JSONB DEFAULT '[]'::jsonb,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_crawl_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_crawl_pages_select" ON public.seo_crawl_pages FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_crawl_pages_insert" ON public.seo_crawl_pages FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE INDEX idx_seo_crawl_pages_run ON public.seo_crawl_pages(crawl_run_id);

-- 6. seo_issues
CREATE TABLE public.seo_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES public.seo_crawl_runs(id) ON DELETE CASCADE,
  page_id UUID REFERENCES public.seo_crawl_pages(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  issue_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  page_url TEXT,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_issues_select" ON public.seo_issues FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_issues_insert" ON public.seo_issues FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_seo_issue_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.severity NOT IN ('critical','warning','info') THEN
    RAISE EXCEPTION 'Invalid seo_issue severity: %', NEW.severity;
  END IF;
  IF NEW.issue_type NOT IN ('broken_link','duplicate_title','duplicate_description','missing_h1','missing_canonical','missing_meta','noindex_conflict','redirect_chain','slow_page','missing_alt','thin_content') THEN
    RAISE EXCEPTION 'Invalid seo_issue type: %', NEW.issue_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_seo_issue BEFORE INSERT OR UPDATE ON public.seo_issues
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_issue_fields();

-- 7. seo_tasks
CREATE TABLE public.seo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES public.seo_domains(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  entity_type TEXT,
  entity_url TEXT,
  linked_issue_id UUID REFERENCES public.seo_issues(id) ON DELETE SET NULL,
  assigned_to UUID,
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seo_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_tasks_select" ON public.seo_tasks FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_tasks_insert" ON public.seo_tasks FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE POLICY "seo_tasks_update" ON public.seo_tasks FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "seo_tasks_delete" ON public.seo_tasks FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));
CREATE TRIGGER update_seo_tasks_updated_at BEFORE UPDATE ON public.seo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.validate_seo_task_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('open','in_progress','done') THEN
    RAISE EXCEPTION 'Invalid seo_task status: %', NEW.status;
  END IF;
  IF NEW.priority NOT IN ('low','medium','high','critical') THEN
    RAISE EXCEPTION 'Invalid seo_task priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_seo_task BEFORE INSERT OR UPDATE ON public.seo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_task_fields();
