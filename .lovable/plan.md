

# Build Status and Remaining Work

## Build Status

The build **succeeded** — the output shows "✓ built in 27.96s". The truncated section contains only Vite warnings about mixed static/dynamic imports of `useCompanyId.ts`, which are non-blocking warnings, not errors.

## What's Already Done

All major pieces from the ERP overhaul are already implemented:

- **Orders**: `order_kind`, `owner_id`, `priority`, `delivery_method`, `expected_value`, `production_override`, `due_date` columns exist. 16-stage status ladder with `ALLOWED_TRANSITIONS` is in `useOrders.ts`. Hard gate triggers (`block_quote_without_customer`, `block_approved_without_price`, `block_ready_without_production`) are deployed. `OrderList.tsx` has kind tabs, priority dots, status filters. `OrderDetail.tsx` has lifecycle fields and status dropdown.
- **Deliveries**: `order_id` FK exists. `block_delivery_without_schedule` trigger enforces driver/vehicle/date.
- **Production Tasks**: `order_id` FK and dedup unique index (`idx_prod_tasks_dedup`) exist.
- **Time Clock**: `block_multiple_open_shifts` trigger exists. Stale shift cleanup was run.
- **Social Posts**: `qa_status` column exists. `block_social_publish_without_qa` trigger enforces approval + 20-char minimum.
- **Dashboards**: All 6 CEO dashboards (Extract Workbench, Production Control, Shop Control, Dispatch Control, Cash Control, Payroll Control) are built and integrated.

## What's Missing (Minor Gaps)

1. **Order interface missing `due_date`** — The `Order` interface in `useOrders.ts` doesn't include `due_date` even though the column exists in the database. This is a one-line fix.

2. **Data reclassification may not have run on all orders** — The cleanup scripts were run as migrations but the user reports "orders mostly pending". A fresh data cleanup pass should be run via the insert tool to re-triage any remaining `pending` orders.

3. **Delivery status `planned` mismatch** — `DispatchControl.tsx` line 26 filters by `d.status === "planned"` for staged count, but the delivery statuses should be `staged/scheduled/in_transit/delivered/canceled`. The filter should use `"staged"` instead.

## Plan

### Step 1: Fix `Order` interface (1 line)
Add `due_date: string | null;` to the `Order` interface in `useOrders.ts`.

### Step 2: Fix DispatchControl staged filter
Change line 26 in `DispatchControl.tsx` from filtering `"planned"` to `"staged"`.

### Step 3: Re-run data cleanup via insert tool
Run idempotent UPDATE statements to reclassify any remaining `pending`/`confirmed` orders using the same logic:
- `customer_id IS NULL` → `needs_customer` + `extract`
- `total_amount = 0 OR NULL` → `needs_pricing` + `extract`  
- `total_amount > 0` → `approved` + `commercial`

Also run time clock stale shift auto-close and social posts QA cleanup for any new bad data.

