DROP FUNCTION IF EXISTS public.get_qb_customer_balances(uuid);

CREATE FUNCTION public.get_qb_customer_balances(p_company_id uuid)
RETURNS TABLE(
  customer_qb_id text,
  open_balance numeric,
  open_invoice_count bigint,
  total_invoice_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.customer_qb_id,
    COALESCE(SUM(CASE WHEN t.balance > 0 THEN t.balance ELSE 0 END), 0) AS open_balance,
    COUNT(*) FILTER (WHERE t.balance > 0) AS open_invoice_count,
    COUNT(*) AS total_invoice_count
  FROM public.qb_transactions t
  WHERE t.company_id = p_company_id
    AND t.entity_type = 'Invoice'
    AND t.is_deleted = false
  GROUP BY t.customer_qb_id;
$$;