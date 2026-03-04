

# Fix Customer View Column Mismatch + Status Filter

## Root Causes

**Problem 1 — Customers page shows comma-name and "archived_odoo_only" records:**
The `v_customers_clean` view has two bugs:
- Status filter uses `status <> 'archived'` but many records have status `'archived_odoo_only'` — these slip through
- View columns (`customer_id`, `display_name`) don't match the TypeScript `Customer` type (`id`, `name`) — the code casts blindly via `as Customer[]` but fields like `customer.id`, `customer.name` are undefined or wrong

**Problem 2 — Search filter uses wrong column names:**
`Customers.tsx` line 39 filters on `name.ilike` but the view has `display_name`, not `name`. PostgREST may error or return no matches.

**Problem 3 — Accounting Customers shows 0:**
This component reads from the `qb_customers` mirror table (not the view). The tab badge shows 1950 items loaded. This is likely a transient rendering/timing issue, not a code bug — but the Customers page issues above are definitely code bugs.

## Fix

### 1. Update the `v_customers_clean` view (DB migration)

Fix the view to:
- Use `status NOT IN ('archived', 'archived_odoo_only')` instead of `status <> 'archived'`
- Alias columns to match the existing `customers` table schema so code continues working without type mismatches: `id` (not `customer_id`), `name` (not `display_name`), and carry through all other columns that `Tables<"customers">` expects

```sql
CREATE OR REPLACE VIEW public.v_customers_clean AS
SELECT
  c.id,
  c.name,
  c.company_name,
  c.normalized_name,
  c.phone,
  c.email,
  c.status,
  c.company_id,
  c.created_at,
  c.updated_at,
  c.quickbooks_id,
  c.customer_type,
  c.payment_terms,
  c.credit_limit,
  c.notes,
  c.tax_exempt,
  c.odoo_id,
  c.merged_into_customer_id,
  c.merged_at,
  c.merged_by,
  c.merge_reason
FROM public.customers c
WHERE c.status NOT IN ('archived', 'archived_odoo_only')
  AND c.merged_into_customer_id IS NULL
  AND position(', ' in c.name) = 0;
```

This makes the view a drop-in replacement for the `customers` table — same column names, same types. No TypeScript casting issues.

### 2. Fix Customers.tsx search filter

The `.or()` filter already uses `name.ilike` and `company_name.ilike` — with the updated view aliases these will now work correctly (the view exposes `name` and `company_name` as real column names).

### 3. Update `useCompanies.ts` hook

Update the hook's column references to match the corrected view (use `name` instead of `display_name`).

### 4. Update `v_customer_company_map` view

Ensure the mapper view also uses the corrected status filter (`NOT IN` instead of `<>`).

## Files Changed

| File | Change |
|------|--------|
| DB migration | Recreate `v_customers_clean` + `v_customer_company_map` with correct columns and status filter |
| `src/hooks/useCompanies.ts` | Update column references (`display_name` → `name`) |

