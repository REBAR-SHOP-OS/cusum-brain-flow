

# Fix: Include Odoo-Sourced Customers in Clean View

## What's happening

"Kingdom Construction Limited" exists in your database (3 records) but has status `archived_odoo_only` — which the `v_customers_clean` view currently excludes. This is a data classification bug, not a missing data issue.

**Database audit results:**
- 782 customers have status `archived_odoo_only`
- 707 of those have active leads linked to them — they're real customers
- 249 are comma-name duplicates (already filtered by the view)
- "Kingdom Construction Limited" specifically: exists as a clean (non-comma) record but is hidden by the status filter
- There is NO "Kingdom Construction" in QuickBooks at all — it's Odoo-only

The Accounting Customers tab (which shows 1950) reads from the QB mirror table (`qb_customers`) — that's working fine. The "0 results" you see is just because your search "kingdo" doesn't match any QB customer name.

## Fix

### 1. Update `v_customers_clean` view (DB migration)

Change the status filter from:
```sql
WHERE status NOT IN ('archived', 'archived_odoo_only')
```
to:
```sql
WHERE status NOT IN ('archived')
```

This brings ~533 legitimate Odoo-sourced company records (782 minus 249 comma-names) back into the clean view, including "Kingdom Construction Limited".

### 2. Update `v_customer_company_map` view

Same status filter fix so the legacy ID mapper stays consistent.

### 3. No frontend changes needed

The views are already used everywhere — once the filter is corrected, Kingdom Construction will appear on the main Customers page automatically.

## Files changed

| File | Change |
|------|--------|
| DB migration | Recreate `v_customers_clean` and `v_customer_company_map` with corrected status filter |

