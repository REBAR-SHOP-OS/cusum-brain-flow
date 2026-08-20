
-- 0) Immutable text normalizer
CREATE OR REPLACE FUNCTION public.norm_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(input,''))), '\s+', ' ', 'g');
$$;

-- 1) Add normalized_name column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='customers' AND column_name='normalized_name'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN normalized_name text;
  END IF;
END $$;

-- Backfill normalized_name
UPDATE public.customers
SET normalized_name = public.norm_text(coalesce(nullif(company_name,''), name))
WHERE normalized_name IS NULL;

-- 2) v_customers_clean — single clean read source for all modules
CREATE OR REPLACE VIEW public.v_customers_clean
WITH (security_invoker = true)
AS
SELECT
  c.id AS customer_id,
  c.name AS display_name,
  coalesce(nullif(c.company_name,''), c.name) AS company_name,
  c.normalized_name,
  c.phone,
  c.email,
  c.status,
  c.company_id,
  c.created_at
FROM public.customers c
WHERE c.status != 'archived'
  AND c.merged_into_customer_id IS NULL
  AND position(', ' IN c.name) = 0;

-- 3) v_customer_company_map — maps any legacy customer_id to its company record
CREATE OR REPLACE VIEW public.v_customer_company_map
WITH (security_invoker = true)
AS
WITH comma_rows AS (
  SELECT
    id AS bad_customer_id,
    trim(split_part(name, ',', 1)) AS company_part,
    public.norm_text(trim(split_part(name, ',', 1))) AS company_norm
  FROM public.customers
  WHERE status != 'archived'
    AND merged_into_customer_id IS NULL
    AND position(', ' IN name) > 0
),
company_rows AS (
  SELECT id AS company_customer_id, normalized_name
  FROM public.customers
  WHERE status != 'archived'
    AND merged_into_customer_id IS NULL
    AND position(', ' IN name) = 0
)
SELECT
  cr.bad_customer_id AS legacy_customer_id,
  co.company_customer_id AS company_customer_id
FROM comma_rows cr
JOIN company_rows co ON co.normalized_name = cr.company_norm

UNION ALL

SELECT
  c.id AS legacy_customer_id,
  c.id AS company_customer_id
FROM public.customers c
WHERE c.status != 'archived'
  AND c.merged_into_customer_id IS NULL
  AND position(', ' IN c.name) = 0;

-- 4) v_orders_enriched — orders with resolved company
CREATE OR REPLACE VIEW public.v_orders_enriched
WITH (security_invoker = true)
AS
SELECT
  o.*,
  m.company_customer_id,
  cc.name AS resolved_company_name
FROM public.orders o
LEFT JOIN public.v_customer_company_map m ON m.legacy_customer_id = o.customer_id
LEFT JOIN public.customers cc ON cc.id = m.company_customer_id;

-- 5) v_leads_enriched — CRM leads with company resolution
CREATE OR REPLACE VIEW public.v_leads_enriched
WITH (security_invoker = true)
AS
SELECT
  l.*,
  cust.name AS customer_name,
  coalesce(nullif(cust.company_name,''), cust.name) AS customer_company_name
FROM public.leads l
LEFT JOIN public.customers cust ON cust.id = l.customer_id;

-- 6) v_communications_enriched — comms with customer/contact info
CREATE OR REPLACE VIEW public.v_communications_enriched
WITH (security_invoker = true)
AS
SELECT
  comm.*,
  cust.name AS customer_name,
  coalesce(nullif(cust.company_name,''), cust.name) AS customer_company_name,
  cont.first_name AS contact_first_name,
  cont.last_name AS contact_last_name,
  cont.email AS contact_email
FROM public.communications comm
LEFT JOIN public.customers cust ON cust.id = comm.customer_id
LEFT JOIN public.contacts cont ON cont.id = comm.contact_id;

-- 7) Chatter tables
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  subject text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_thread_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id, entity_type, entity_id)
);

-- RLS on chatter tables
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access chat_threads in their company"
  ON public.chat_threads FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can access chat_thread_messages via thread"
  ON public.chat_thread_messages FOR ALL TO authenticated
  USING (thread_id IN (
    SELECT id FROM public.chat_threads
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ))
  WITH CHECK (thread_id IN (
    SELECT id FROM public.chat_threads
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can access chat_thread_links via thread"
  ON public.chat_thread_links FOR ALL TO authenticated
  USING (thread_id IN (
    SELECT id FROM public.chat_threads
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ))
  WITH CHECK (thread_id IN (
    SELECT id FROM public.chat_threads
    WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- 8) Comma-name prevention trigger
CREATE OR REPLACE FUNCTION public.trg_prevent_comma_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_part text;
  v_person_part text;
  v_company_id uuid;
BEGIN
  -- Only act on names with ", " pattern
  IF position(', ' IN NEW.name) = 0 THEN
    NEW.normalized_name := public.norm_text(coalesce(nullif(NEW.company_name,''), NEW.name));
    RETURN NEW;
  END IF;

  v_company_part := trim(split_part(NEW.name, ', ', 1));
  v_person_part  := trim(split_part(NEW.name, ', ', 2));

  -- Find or create the company-only customer
  SELECT id INTO v_company_id
  FROM public.customers
  WHERE normalized_name = public.norm_text(v_company_part)
    AND status != 'archived'
    AND merged_into_customer_id IS NULL
    AND position(', ' IN name) = 0
    AND company_id = NEW.company_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO public.customers (name, company_name, normalized_name, company_id, status, customer_type)
    VALUES (v_company_part, v_company_part, public.norm_text(v_company_part), NEW.company_id, 'active', 'commercial')
    RETURNING id INTO v_company_id;
  END IF;

  -- Create a contact under the company
  INSERT INTO public.contacts (customer_id, first_name, last_name, email, phone, company_id)
  VALUES (
    v_company_id,
    split_part(v_person_part, ' ', 1),
    CASE WHEN position(' ' IN v_person_part) > 0
      THEN substring(v_person_part FROM position(' ' IN v_person_part) + 1)
      ELSE NULL
    END,
    NEW.email,
    NEW.phone,
    NEW.company_id
  )
  ON CONFLICT DO NOTHING;

  -- Rewrite the insert to be the company-only record
  NEW.name := v_company_part;
  NEW.company_name := v_company_part;
  NEW.normalized_name := public.norm_text(v_company_part);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_comma_customer ON public.customers;
CREATE TRIGGER trg_prevent_comma_customer
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_comma_customer();
