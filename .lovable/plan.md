

# Customer/Contact Connector Tools + Safe Duplicate Merge

## Overview
Add 5 new actions to the existing `vizzy-erp-action` edge function to manage customers, contacts, and safe duplicate merging — all ERP-only, no QB/Odoo writes.

## Step 1: Database Migration

Add merge tracking columns to `customers` table:

```sql
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by text,
  ADD COLUMN IF NOT EXISTS merge_reason text;
```

No new tables needed. The `contacts` table already exists with `customer_id` FK.

## Step 2: Add 5 Actions to `vizzy-erp-action/index.ts`

All actions go into the existing `switch(action)` block. Auth + admin check already handled.

### A) `get_customer`
- Input: `{ id }` → Select from `customers` where id, include company_id scoping
- Return full customer row

### B) `update_customer`
- Input: `{ id, payload, suppress_external_sync? }`
- Block edits on archived customers (except status/merge fields)
- Update only whitelisted fields
- Skip any sync triggers (no QB/Odoo writes)

### C) `list_contacts`
- Input: `{ company_id, limit?, offset? }`
- Select from `contacts` where `customer_id = company_id`
- Pagination support

### D) `create_contact`
- Input: `{ company_id, payload: { first_name, last_name, email?, phone?, role?, is_primary? } }`
- Dedup check: if email provided, check uniqueness within same customer; else check phone uniqueness
- Insert and return

### E) `merge_customers`
- Input: `{ primary_id, duplicate_ids[], dry_run?, merge_reason?, suppress_external_sync? }`
- **Dry run mode**: Count affected rows per table, return preview
- **Execute mode**: For each duplicate:

**Tables to re-link** (all FK references to `customers.id`):

| Table | Column |
|-------|--------|
| contacts | customer_id |
| orders | customer_id |
| quotes | customer_id |
| projects | customer_id |
| deliveries → delivery_stops | customer_id |
| leads | customer_id |
| communications | customer_id |
| estimation_projects | customer_id |
| pickup_orders | customer_id |
| tasks | customer_id |
| recurring_transactions | customer_id |
| customer_health_scores | customer_id |
| client_performance_memory | customer_id |
| customer_user_links | customer_id |
| lead_outcome_memory | customer_id |
| accounting_mirror | customer_id |

**Merge steps per duplicate:**
1. Count rows in each table referencing the duplicate (for audit)
2. Update all rows to point to `primary_id`
3. Handle contact dedup (skip if email already exists under primary)
4. If duplicate is a person-type customer: parse `first_name`/`last_name` and create a contact under primary
5. Archive duplicate: `status='archived'`, set `merged_into_customer_id`, `merged_at`, `merged_by`, `merge_reason`
6. Log activity event

**Idempotency**: If duplicate already has `merged_into_customer_id = primary_id`, skip it.

**No external sync**: Does not touch `quickbooks_id`, does not call QB/Odoo APIs, does not enqueue sync events.

## Step 3: Safety Guardrails

- `suppress_external_sync` defaults to `true` — the implementation simply never calls any sync function
- No `quickbooks_id` or integration columns are modified
- Archived customers retain their `quickbooks_id` for historical reference
- All re-links use the service role client within the edge function (bypasses RLS)
- Activity events logged for audit trail

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/vizzy-erp-action/index.ts` | Add 5 new case blocks |
| Database migration | Add 4 merge columns to `customers` |

## What This Does NOT Touch
- No QB/Odoo API calls
- No sync triggers or webhooks
- No frontend changes
- No changes to `quickbooks_id` or integration columns

