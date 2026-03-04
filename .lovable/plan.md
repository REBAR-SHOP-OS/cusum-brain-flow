

# Unify Customers Across the App

## Problem

Two completely different customer views exist:
- **Sidebar /customers** (`Customers.tsx`): reads from `v_customers_clean` (local DB) — shows 1000+ customers, but **missing company_id filter** (multi-tenant violation)
- **Accounting Customers tab** (`AccountingCustomers.tsx`): reads from `qb_customers` mirror (QuickBooks data) — shows different results, search "kingdom" returns 0

These should be one unified view with the same data source.

## Root Cause

`AccountingCustomers` gets its customer list from `useQuickBooksData().customers` which reads the `qb_customers` table. The CRM page reads `v_customers_clean` (the `customers` table). They're fundamentally different tables with different data.

## Plan

### 1. Fix AccountingCustomers to use the same data source

Replace the QB-mirror-based customer list in `AccountingCustomers.tsx` with a query to `v_customers_clean` filtered by `company_id`. This makes it identical to the sidebar Customers page data.

- Query `v_customers_clean` with `.eq("company_id", companyId)` and local search filter
- Enrich with QB balance data from the existing `get_qb_customer_balances` RPC (already in use)
- Keep the sync-from-QB flow for customers that exist in QB but not locally (existing behavior)
- Display `company_name` prominently (e.g., "Kingdom Construction Limited") instead of just `name`

### 2. Fix CRM Customers page multi-tenant scoping

`Customers.tsx` currently queries `v_customers_clean` without any `company_id` filter — this is a multi-tenant violation. Add `useCompanyId()` and filter by it.

### 3. Ensure company_name is the primary display

Both views will show `company_name` as the primary column (e.g., "Kingdom Construction Limited"), with `name` as secondary. This addresses the user's request that "Kingdom Construction" should show as "Kingdom Construction Limited".

## Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/AccountingCustomers.tsx` | Switch from `data.customers` (qb_customers) to querying `v_customers_clean` with company_id filter; keep QB balance enrichment |
| `src/pages/Customers.tsx` | Add `useCompanyId()` and `.eq("company_id", companyId)` filter to the query |

