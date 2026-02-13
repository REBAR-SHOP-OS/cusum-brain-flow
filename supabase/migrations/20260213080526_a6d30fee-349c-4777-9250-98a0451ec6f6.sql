
-- Migrate existing accounting_mirror invoices → qb_transactions
-- Only copy rows that have a valid quickbooks_id (not prefixed like vendor_xxx)
INSERT INTO public.qb_transactions (company_id, qb_realm_id, qb_id, entity_type, txn_date, doc_number, total_amt, balance, customer_qb_id, raw_json, last_synced_at, created_at)
SELECT
  am.company_id,
  '' AS qb_realm_id,
  am.quickbooks_id,
  am.entity_type,
  (am.data->>'TxnDate')::date,
  am.data->>'DocNumber',
  COALESCE((am.data->>'TotalAmt')::numeric, 0),
  COALESCE(am.balance, 0),
  am.data->'CustomerRef'->>'value',
  am.data,
  am.last_synced_at,
  am.created_at
FROM public.accounting_mirror am
WHERE am.entity_type = 'Invoice'
  AND am.quickbooks_id NOT LIKE 'vendor_%'
ON CONFLICT (company_id, qb_id, entity_type) DO NOTHING;

-- Migrate existing accounting_mirror vendors → qb_vendors
INSERT INTO public.qb_vendors (company_id, qb_realm_id, qb_id, display_name, company_name, balance, is_active, raw_json, last_synced_at, created_at)
SELECT
  am.company_id,
  '' AS qb_realm_id,
  REPLACE(am.quickbooks_id, 'vendor_', ''),
  am.data->>'DisplayName',
  am.data->>'CompanyName',
  COALESCE(am.balance, 0),
  COALESCE((am.data->>'Active')::boolean, true),
  am.data,
  am.last_synced_at,
  am.created_at
FROM public.accounting_mirror am
WHERE am.entity_type = 'Vendor'
  AND am.quickbooks_id LIKE 'vendor_%'
ON CONFLICT (company_id, qb_id) DO NOTHING;

-- Migrate existing customers → qb_customers
INSERT INTO public.qb_customers (company_id, qb_realm_id, qb_id, display_name, company_name, is_active, raw_json, last_synced_at, created_at)
SELECT
  c.company_id,
  '' AS qb_realm_id,
  c.quickbooks_id,
  c.name,
  COALESCE(c.company_name, ''),
  c.status = 'active',
  jsonb_build_object('DisplayName', c.name, 'CompanyName', c.company_name, 'Id', c.quickbooks_id),
  c.updated_at,
  c.created_at
FROM public.customers c
WHERE c.quickbooks_id IS NOT NULL
  AND c.company_id IS NOT NULL
ON CONFLICT (company_id, qb_id) DO NOTHING;
