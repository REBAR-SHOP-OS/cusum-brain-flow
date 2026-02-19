

# Build `/accounting/health` -- Diagnostic Dashboard

## Overview

Create a read-only diagnostic page at `/accounting/health` to diagnose the `$0.00` balance display bug. The page will query `qb_transactions` directly via 3 new database RPCs and display the results.

---

## Step 1: Database Migration (3 RPCs + 2 Indexes)

A single migration creating:

**A) `accounting_health_summary(p_company_id uuid)`**
Returns one row with:
- `total_invoices` -- COUNT where entity_type = 'Invoice' and not deleted
- `open_balance_count` -- COUNT where balance > 0
- `last_invoice_updated_at` -- MAX(updated_at)
- `missing_customer_qb_id_count` -- COUNT where customer_qb_id IS NULL or empty
- `null_balance_count` -- COUNT where balance IS NULL

Since `balance` is already `numeric`, no regex/text parsing is needed.

**B) `accounting_health_top_customers(p_company_id uuid, p_limit int default 20)`**
Groups invoices by `customer_qb_id`, sums `balance` where > 0, returns top N rows ordered by open balance descending.

**C) `accounting_health_customer_debug(p_company_id uuid, p_customer_qb_id text)`**
For a single customer: invoice count, total open balance, and a JSONB array of up to 10 most recent open invoices (with `qb_id`, `doc_number`, `txn_date`, `balance`, `updated_at`).

**Indexes:**
- `idx_qb_txn_company_type_deleted` on `(company_id, entity_type, is_deleted)`
- `idx_qb_txn_company_customer` on `(company_id, customer_qb_id)`

No RLS changes needed -- these are STABLE functions that respect existing row-level permissions on `qb_transactions`.

---

## Step 2: Add Route in App.tsx

Add a new route `/accounting/health` pointing to a lazy-loaded `AccountingHealth` page, wrapped in the existing `P` (ProtectedRoute + AppLayout) wrapper.

---

## Step 3: Create `src/pages/AccountingHealth.tsx`

A single-page component with three sections:

**Section A: Mirror Status**
- 5 stat cards (total invoices, open balance count, last updated, missing customer IDs, null balances)
- Alert list that flags issues (e.g., "No invoices found", "No invoices with balance > 0", "X invoices missing customer_qb_id")
- Uses existing `Card`, `Badge` components

**Section B: Top 20 Customer Balances**
- Table showing `customer_qb_id`, open balance (formatted as USD), and open invoice count
- Uses existing `Table` components
- Clickable rows auto-populate the debug tool below

**Section C: Customer Debug Tool**
- Text input for a QuickBooks Customer ID
- "Debug" button calls the `accounting_health_customer_debug` RPC
- Displays invoice count, total open balance, and raw JSON of matching invoices
- Uses existing `Input`, `Button` components

Data fetching uses `useQuery` from TanStack React Query, calling `supabase.rpc()` for each function. The `companyId` comes from the existing `useCompanyId()` hook.

---

## Step 4: Fix Join Guard in AccountingCustomers.tsx

Update lines 111-113 in `AccountingCustomers.tsx` to prevent silent `$0.00` mismatches:

```text
Before:
  const custInvoices = invoices.filter(i => i.CustomerRef?.value === c.Id);

After:
  const custInvoices = invoices.filter(i => {
    const refVal = i.CustomerRef?.value;
    if (!refVal) return false;
    return String(refVal) === String(c.Id);
  });
```

This guards against null/undefined `CustomerRef.value` and ensures consistent string comparison.

---

## Files Changed

```text
NEW:   src/pages/AccountingHealth.tsx
EDIT:  src/App.tsx  (add route + import)
EDIT:  src/components/accounting/AccountingCustomers.tsx  (fix join guard, lines 111-113)
DB:    1 migration (3 RPCs + 2 indexes)
```
