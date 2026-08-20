
-- Drop unsafe anon SELECT policies
DROP POLICY IF EXISTS "Allow anon read access for customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon read access for leads" ON public.leads;

-- Revoke anon privileges on enriched views
REVOKE ALL ON public.v_customers_clean FROM anon;
REVOKE ALL ON public.v_customer_company_map FROM anon;
REVOKE ALL ON public.v_orders_enriched FROM anon;
REVOKE ALL ON public.v_deliveries_enriched FROM anon;
REVOKE ALL ON public.v_leads_enriched FROM anon;
REVOKE ALL ON public.v_communications_enriched FROM anon;
REVOKE ALL ON public.profiles_safe FROM anon;
