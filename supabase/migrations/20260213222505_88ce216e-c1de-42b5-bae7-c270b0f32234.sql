
-- Prospect batches table
CREATE TABLE public.prospect_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  company_id uuid NOT NULL,
  region text NOT NULL DEFAULT 'Canada/USA',
  status text NOT NULL DEFAULT 'generating',
  prospect_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company batches"
  ON public.prospect_batches FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert batches for their company"
  ON public.prospect_batches FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company batches"
  ON public.prospect_batches FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Prospects table
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.prospect_batches(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_title text,
  email text,
  phone text,
  city text,
  industry text,
  estimated_value numeric,
  fit_reason text,
  intro_angle text,
  status text NOT NULL DEFAULT 'pending',
  lead_id uuid REFERENCES public.leads(id),
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company prospects"
  ON public.prospects FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert prospects for their company"
  ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update their company prospects"
  ON public.prospects FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Index for fast batch lookups
CREATE INDEX idx_prospects_batch_id ON public.prospects(batch_id);
CREATE INDEX idx_prospects_company_id ON public.prospects(company_id);
CREATE INDEX idx_prospect_batches_company_id ON public.prospect_batches(company_id);

-- Validate status values
CREATE OR REPLACE FUNCTION public.validate_prospect_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'emailed') THEN
    RAISE EXCEPTION 'Invalid prospect status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_prospect_status_trigger
  BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.validate_prospect_status();

CREATE OR REPLACE FUNCTION public.validate_prospect_batch_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('generating', 'ready', 'archived') THEN
    RAISE EXCEPTION 'Invalid prospect_batch status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_prospect_batch_status_trigger
  BEFORE INSERT OR UPDATE ON public.prospect_batches
  FOR EACH ROW EXECUTE FUNCTION public.validate_prospect_batch_status();
