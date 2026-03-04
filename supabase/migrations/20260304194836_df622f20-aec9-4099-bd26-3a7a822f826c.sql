
-- SAFE MEGA PATCH: Cherry-picked additions

-- 0) norm_text helper
CREATE OR REPLACE FUNCTION public.norm_text(input text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$ SELECT regexp_replace(lower(trim(coalesce(input,''))), '\s+', ' ', 'g'); $$;

-- 1) companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text,
  normalized_name text GENERATED ALWAYS AS (public.norm_text(legal_name)) STORED,
  company_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_normalized_name_uq ON public.companies(normalized_name);

-- 2) scopes_of_work table
CREATE TABLE IF NOT EXISTS public.scopes_of_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  scope_name text NOT NULL,
  site_address text,
  target_eta date,
  invoice_number text,
  invoice_date date,
  lat double precision,
  lng double precision,
  gps_accuracy double precision,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scopes_project_id_idx ON public.scopes_of_work(project_id);
CREATE INDEX IF NOT EXISTS scopes_company_id_idx ON public.scopes_of_work(company_id);
CREATE INDEX IF NOT EXISTS scopes_contact_id_idx ON public.scopes_of_work(contact_id);

-- 3) entity_links table (universal polymorphic linker)
CREATE TABLE IF NOT EXISTS public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.chat_thread_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entity_links_entity_idx ON public.entity_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS entity_links_thread_idx ON public.entity_links(thread_id);

-- 4) v_deliveries_enriched (joins through order_id → orders.customer_id)
CREATE OR REPLACE VIEW public.v_deliveries_enriched AS
SELECT
  d.*,
  o.customer_id,
  m.company_customer_id,
  cc.name AS company_name
FROM public.deliveries d
LEFT JOIN public.orders o ON o.id = d.order_id
LEFT JOIN public.v_customer_company_map m ON m.legacy_customer_id = o.customer_id
LEFT JOIN public.customers cc ON cc.id = m.company_customer_id;

-- 5) RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scopes_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_companies" ON public.companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_scopes" ON public.scopes_of_work FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_scopes" ON public.scopes_of_work FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_scopes" ON public.scopes_of_work FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_entity_links" ON public.entity_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_entity_links" ON public.entity_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_entity_links" ON public.entity_links FOR DELETE TO authenticated USING (true);
