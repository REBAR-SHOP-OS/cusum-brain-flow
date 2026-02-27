

## Fix Customer Invoice Count Showing 0

The screenshot shows CON-FRAME LTD with "0" in the Invoices column, but the database has **17 invoices** for this customer (all fully paid with balance = 0). The RPC function `get_qb_customer_balances` only counts invoices where `balance > 0`, so fully-paid customers appear to have zero invoices.

### Changes

**1. Database: Update `get_qb_customer_balances` RPC**

Replace the function to return both total invoice count and open (unpaid) invoice count:

```sql
CREATE OR REPLACE FUNCTION public.get_qb_customer_balances(p_company_id uuid)
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
```

Key change: removes the `AND t.balance > 0` WHERE filter so all invoices are counted, then uses `FILTER (WHERE t.balance > 0)` for the open-specific columns.

**2. `src/components/accounting/AccountingCustomers.tsx`**

- Update the `balanceMap` query to also store `totalInvoiceCount` from the new RPC column
- Change the "Invoices" column to display `totalInvoiceCount` (all invoices) instead of `openInvoiceCount` (only unpaid)
- The "Open Balance" column continues to use the existing `openBalance` field

### Technical Detail

The current RPC has `AND t.balance > 0` in the WHERE clause, which excludes all paid invoices from the result set entirely. CON-FRAME has 17 invoices but all are paid (balance = 0), so the RPC returns no rows for that customer, resulting in the fallback value of 0. The fix moves the balance filter into a `FILTER` clause on the aggregate functions.

