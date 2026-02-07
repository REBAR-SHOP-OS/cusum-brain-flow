
-- ============================================================
-- EXTRACT PIPELINE TABLES
-- ============================================================

-- 1. extract_sessions: parent record for each extraction batch
CREATE TABLE public.extract_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID,
  name TEXT NOT NULL,
  customer TEXT,
  site_address TEXT,
  manifest_type TEXT NOT NULL DEFAULT 'delivery',
  target_eta DATE,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status validation trigger
CREATE OR REPLACE FUNCTION public.validate_extract_session_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('uploaded','extracting','extracted','mapping','validated','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid extract_session status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_extract_session_status
BEFORE INSERT OR UPDATE ON public.extract_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_extract_session_status();

CREATE TRIGGER trg_extract_sessions_updated_at
BEFORE UPDATE ON public.extract_sessions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.extract_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions in their company"
ON public.extract_sessions FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Office and admin can insert sessions"
ON public.extract_sessions FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Office and admin can update sessions"
ON public.extract_sessions FOR UPDATE
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Admin can delete sessions"
ON public.extract_sessions FOR DELETE
USING (company_id = get_user_company_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role));


-- 2. extract_raw_files: files attached to a session
CREATE TABLE public.extract_raw_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.extract_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.extract_raw_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view files in their company"
ON public.extract_raw_files FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Office and admin can insert files"
ON public.extract_raw_files FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Office and admin can update files"
ON public.extract_raw_files FOR UPDATE
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Admin can delete files"
ON public.extract_raw_files FOR DELETE
USING (company_id = get_user_company_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role));


-- 3. extract_rows: individual extracted line items
CREATE TABLE public.extract_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.extract_sessions(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.extract_raw_files(id) ON DELETE SET NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  dwg TEXT,
  item_number TEXT,
  grade TEXT,
  grade_mapped TEXT,
  mark TEXT,
  quantity INTEGER DEFAULT 0,
  bar_size TEXT,
  bar_size_mapped TEXT,
  shape_type TEXT,
  shape_code_mapped TEXT,
  total_length_mm INTEGER,
  dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC,
  dim_e NUMERIC, dim_f NUMERIC, dim_g NUMERIC, dim_h NUMERIC,
  dim_j NUMERIC, dim_k NUMERIC, dim_o NUMERIC, dim_r NUMERIC,
  weight_kg NUMERIC,
  customer TEXT,
  reference TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'raw',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extract_rows_session ON public.extract_rows(session_id);

ALTER TABLE public.extract_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rows via session company"
ON public.extract_rows FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_rows.session_id
    AND s.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Office and admin can insert rows"
ON public.extract_rows FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_rows.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
));

CREATE POLICY "Office and admin can update rows"
ON public.extract_rows FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_rows.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
));

CREATE POLICY "Admin can delete rows"
ON public.extract_rows FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_rows.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
));


-- 4. extract_mapping: rules for normalizing extracted data
CREATE TABLE public.extract_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  source_field TEXT NOT NULL,
  source_value TEXT NOT NULL,
  mapped_value TEXT NOT NULL,
  is_auto BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, source_field, source_value)
);

ALTER TABLE public.extract_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mappings in their company"
ON public.extract_mapping FOR SELECT
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Office and admin can insert mappings"
ON public.extract_mapping FOR INSERT
WITH CHECK (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Office and admin can update mappings"
ON public.extract_mapping FOR UPDATE
USING (company_id = get_user_company_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[]));

CREATE POLICY "Admin can delete mappings"
ON public.extract_mapping FOR DELETE
USING (company_id = get_user_company_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role));


-- 5. extract_errors: validation errors per row
CREATE TABLE public.extract_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.extract_sessions(id) ON DELETE CASCADE,
  row_id UUID REFERENCES public.extract_rows(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extract_errors_session ON public.extract_errors(session_id);

ALTER TABLE public.extract_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view errors via session company"
ON public.extract_errors FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_errors.session_id
    AND s.company_id = get_user_company_id(auth.uid())
));

CREATE POLICY "Office and admin can insert errors"
ON public.extract_errors FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_errors.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
));

CREATE POLICY "Office and admin can update errors"
ON public.extract_errors FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_errors.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin','office']::app_role[])
));

CREATE POLICY "Admin can delete errors"
ON public.extract_errors FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.extract_sessions s
  WHERE s.id = extract_errors.session_id
    AND s.company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
));

-- Enable realtime for extract_sessions to track status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.extract_sessions;
