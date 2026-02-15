
-- Create seo_link_audit table
CREATE TABLE public.seo_link_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES public.seo_domains(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  link_href TEXT,
  anchor_text TEXT,
  link_type TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'ok',
  suggestion TEXT,
  suggested_href TEXT,
  suggested_anchor TEXT,
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seo_link_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to company
CREATE POLICY "Users can view their company link audits"
  ON public.seo_link_audit FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert their company link audits"
  ON public.seo_link_audit FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company link audits"
  ON public.seo_link_audit FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete their company link audits"
  ON public.seo_link_audit FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Service role policy for edge functions
CREATE POLICY "Service role full access to link audits"
  ON public.seo_link_audit FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_seo_link_audit_domain ON public.seo_link_audit(domain_id);
CREATE INDEX idx_seo_link_audit_status ON public.seo_link_audit(status);
CREATE INDEX idx_seo_link_audit_company ON public.seo_link_audit(company_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_seo_link_audit_fields()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.link_type NOT IN ('internal', 'external', 'rsic_opportunity') THEN
    RAISE EXCEPTION 'Invalid link_type: %', NEW.link_type;
  END IF;
  IF NEW.status NOT IN ('ok', 'broken', 'missing_anchor', 'nofollow_issue', 'opportunity') THEN
    RAISE EXCEPTION 'Invalid link audit status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_seo_link_audit
  BEFORE INSERT OR UPDATE ON public.seo_link_audit
  FOR EACH ROW EXECUTE FUNCTION public.validate_seo_link_audit_fields();
