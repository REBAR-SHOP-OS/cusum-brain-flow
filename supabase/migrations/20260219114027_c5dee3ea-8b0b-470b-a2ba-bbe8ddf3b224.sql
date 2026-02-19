
-- A) accounting_health_summary
CREATE OR REPLACE FUNCTION public.accounting_health_summary(p_company_id uuid)
RETURNS TABLE (
  total_invoices bigint,
  open_balance_count bigint,
  last_invoice_updated_at timestamptz,
  missing_customer_qb_id_count bigint,
  null_balance_count bigint
)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE entity_type = 'Invoice' AND coalesce(is_deleted, false) = false) AS total_invoices,
    count(*) FILTER (WHERE entity_type = 'Invoice' AND coalesce(is_deleted, false) = false AND balance > 0) AS open_balance_count,
    max(updated_at) FILTER (WHERE entity_type = 'Invoice' AND coalesce(is_deleted, false) = false) AS last_invoice_updated_at,
    count(*) FILTER (WHERE entity_type = 'Invoice' AND coalesce(is_deleted, false) = false AND (customer_qb_id IS NULL OR customer_qb_id = '')) AS missing_customer_qb_id_count,
    count(*) FILTER (WHERE entity_type = 'Invoice' AND coalesce(is_deleted, false) = false AND balance IS NULL) AS null_balance_count
  FROM qb_transactions
  WHERE company_id = p_company_id;
$$;

-- B) accounting_health_top_customers
CREATE OR REPLACE FUNCTION public.accounting_health_top_customers(p_company_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  customer_qb_id text,
  open_balance numeric,
  open_invoice_count bigint
)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT
    t.customer_qb_id,
    sum(t.balance) AS open_balance,
    count(*) AS open_invoice_count
  FROM qb_transactions t
  WHERE t.company_id = p_company_id
    AND t.entity_type = 'Invoice'
    AND coalesce(t.is_deleted, false) = false
    AND t.customer_qb_id IS NOT NULL
    AND t.customer_qb_id != ''
    AND t.balance IS NOT NULL
    AND t.balance > 0
  GROUP BY t.customer_qb_id
  ORDER BY open_balance DESC
  LIMIT p_limit;
$$;

-- C) accounting_health_customer_debug
CREATE OR REPLACE FUNCTION public.accounting_health_customer_debug(p_company_id uuid, p_customer_qb_id text)
RETURNS TABLE (
  invoice_count bigint,
  total_open_balance numeric,
  invoices jsonb
)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  WITH inv AS (
    SELECT qb_id, doc_number, txn_date, balance, updated_at
    FROM qb_transactions
    WHERE company_id = p_company_id
      AND entity_type = 'Invoice'
      AND coalesce(is_deleted, false) = false
      AND customer_qb_id = p_customer_qb_id
  ),
  open_inv AS (
    SELECT * FROM inv WHERE balance IS NOT NULL AND balance > 0
  )
  SELECT
    (SELECT count(*) FROM inv) AS invoice_count,
    (SELECT coalesce(sum(balance), 0) FROM open_inv) AS total_open_balance,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'qb_id', x.qb_id,
          'doc_number', x.doc_number,
          'txn_date', x.txn_date,
          'balance', x.balance,
          'updated_at', x.updated_at
        )
        ORDER BY x.updated_at DESC
      )
      FROM (SELECT * FROM open_inv ORDER BY updated_at DESC LIMIT 10) x
    ) AS invoices;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_qb_txn_company_type_deleted
ON qb_transactions (company_id, entity_type, is_deleted);

CREATE INDEX IF NOT EXISTS idx_qb_txn_company_customer
ON qb_transactions (company_id, customer_qb_id);
