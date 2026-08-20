-- Fix v_customers_clean: include archived_odoo_only customers (they're legitimate Odoo-sourced records)
CREATE OR REPLACE VIEW public.v_customers_clean AS
SELECT
  id AS customer_id,
  id,
  name,
  name AS display_name,
  company_name,
  normalized_name,
  phone,
  email,
  status,
  company_id,
  created_at,
  updated_at,
  quickbooks_id,
  customer_type,
  payment_terms,
  credit_limit,
  notes,
  merged_into_customer_id,
  merged_at,
  merged_by,
  merge_reason
FROM customers c
WHERE status NOT IN ('archived')
  AND merged_into_customer_id IS NULL
  AND position(', ' in name) = 0;

-- Fix v_customer_company_map: same status filter correction
CREATE OR REPLACE VIEW public.v_customer_company_map AS
SELECT
  id AS legacy_customer_id,
  CASE
    WHEN position(', ' in name) > 0 THEN
      COALESCE(
        (SELECT c2.id FROM customers c2
         WHERE c2.normalized_name = c.normalized_name
           AND position(', ' in c2.name) = 0
           AND c2.status NOT IN ('archived')
           AND c2.merged_into_customer_id IS NULL
         LIMIT 1),
        id
      )
    ELSE id
  END AS company_customer_id,
  company_id
FROM customers c
WHERE status NOT IN ('archived')
  AND merged_into_customer_id IS NULL;