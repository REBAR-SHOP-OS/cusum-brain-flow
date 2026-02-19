
CREATE OR REPLACE FUNCTION public.get_qb_customer_balances(p_company_id uuid)
RETURNS TABLE(customer_qb_id text, open_balance numeric, open_invoice_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    t.customer_qb_id,
    COALESCE(SUM(t.balance), 0) AS open_balance,
    COUNT(*)::bigint AS open_invoice_count
  FROM public.qb_transactions t
  WHERE t.company_id = p_company_id
    AND t.entity_type = 'Invoice'
    AND t.is_deleted = false
    AND t.balance > 0
  GROUP BY t.customer_qb_id;
$$;
