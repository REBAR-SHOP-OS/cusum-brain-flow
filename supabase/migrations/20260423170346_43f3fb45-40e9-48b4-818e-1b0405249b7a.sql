CREATE OR REPLACE VIEW public.v_customers_clean
WITH (security_invoker = true) AS
SELECT id AS customer_id, id, name, name AS display_name,
       company_name, normalized_name, phone, email, status, company_id,
       created_at, updated_at, quickbooks_id, customer_type,
       payment_terms, credit_limit, notes,
       merged_into_customer_id, merged_at, merged_by, merge_reason
FROM public.customers
WHERE status <> 'archived'
  AND merged_into_customer_id IS NULL;