
ALTER VIEW public.v_customers_clean SET (security_invoker = true);
ALTER VIEW public.v_customer_company_map SET (security_invoker = true);
ALTER VIEW public.v_orders_enriched SET (security_invoker = true);
ALTER VIEW public.v_deliveries_enriched SET (security_invoker = true);
ALTER VIEW public.v_leads_enriched SET (security_invoker = true);
ALTER VIEW public.v_communications_enriched SET (security_invoker = true);
