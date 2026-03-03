

# ERP Order Lifecycle Overhaul — Full Build Plan

## Current State (What Exists)

| Entity | Records | Current Statuses | Key Gaps |
|--------|---------|-----------------|----------|
| Orders | 28 (all "pending") | pending → confirmed → in_production → invoiced → partially_paid → paid → closed → cancelled | No `order_kind`, no `owner_id`, no `priority`, no `delivery_method`, no pre-commercial stages |
| Deliveries | 1 (delivered) | planned → loading → in-transit → delivered | No scheduling enforcement (driver/vehicle/date not required) |
| Cut Plan Items | 120 | queued → cutting → cut_done → bending → clearance → complete | Already linked via `work_order_id` → `work_orders.order_id`. Phase auto-advance trigger exists |
| Leads | 2,956 | 15+ stages including won(800), lost(720), quotation_bids(708) | `owner_id` missing from leads table, `customer_id` exists |
| Work Orders | exist | Has `order_id`, `barlist_id`, `project_id` | Links production to orders already |

**Existing guards:** `block_production_without_approval` trigger, `block_delivery_without_qc` trigger, `auto_advance_item_phase` trigger, `ALLOWED_TRANSITIONS` map in frontend code.

---

## Phase 1 — Data Model Changes (Migration)

### 1A. Add columns to `orders`

```sql
ALTER TABLE orders
  ADD COLUMN order_kind TEXT NOT NULL DEFAULT 'commercial',
  ADD COLUMN owner_id UUID REFERENCES profiles(id),
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'delivery';
```

- `order_kind`: `'extract'` or `'commercial'`
- `priority`: `'low'`, `'medium'`, `'high'`
- `delivery_method`: `'pickup'` or `'delivery'`
- `owner_id`: sales/estimator who owns this order

### 1B. Expand order status ladder

Replace the current 8-status ladder with 16 statuses spanning extract-through-payment:

**Extract / Pre-commercial:**
`extract_new` → `needs_customer` → `needs_scope_confirm` → `needs_pricing` → `quote_ready` → `quote_sent` → `won` / `lost` / `archived`

**Commercial / Ops:**
`approved` → `queued_production` → `in_production` → `ready` → `delivery_staged` / `ready_for_pickup` → `delivered` → `invoiced` → `paid`

Update `ALLOWED_TRANSITIONS` in `useOrders.ts` and all UI components that reference statuses.

### 1C. No changes needed on deliveries or cut_plan_items

Deliveries already have `driver_name`, `vehicle`, `scheduled_date`. Cut plan items already have `phase` with auto-advance. We just need enforcement triggers.

---

## Phase 2 — Hard Gate Triggers (Migration)

### 2A. Block `quote_sent` without customer

```sql
CREATE OR REPLACE FUNCTION block_quote_without_customer()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'quote_sent' AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'Cannot send quote: no customer assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2B. Block `approved` without price

```sql
IF NEW.status = 'approved' AND (NEW.total_amount IS NULL OR NEW.total_amount = 0) THEN
  RAISE EXCEPTION 'Cannot approve: total_amount is zero';
END IF;
```

### 2C. Block delivery scheduling without driver/vehicle/date

```sql
CREATE OR REPLACE FUNCTION block_delivery_without_schedule()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('scheduled','in-transit') AND OLD.status NOT IN ('scheduled','in-transit') THEN
    IF NEW.driver_name IS NULL OR NEW.vehicle IS NULL OR NEW.scheduled_date IS NULL THEN
      RAISE EXCEPTION 'Cannot schedule delivery: driver, vehicle, and date are required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2D. Block `ready` unless production complete

A trigger that checks all `cut_plan_items` linked through `work_orders` to the order are in phase `'complete'` or `'clearance'` (with an explicit override field `production_override BOOLEAN` on orders).

---

## Phase 3 — One-Time Data Reclassification (Migration)

Reclassify existing 28 pending orders:

```sql
-- Orders with $0 = extract
UPDATE orders SET order_kind = 'extract', status = 'needs_pricing'
WHERE total_amount = 0 OR total_amount IS NULL;

-- Orders with no customer = needs_customer  
UPDATE orders SET status = 'needs_customer'
WHERE customer_id IS NULL AND (total_amount = 0 OR total_amount IS NULL);

-- Orders with total > 0 = commercial approved
UPDATE orders SET order_kind = 'commercial', status = 'approved'
WHERE total_amount > 0;
```

---

## Phase 4 — Frontend Changes

### 4A. Update `useOrders.ts`

- Expand `ALLOWED_TRANSITIONS` map to cover all 16 statuses
- Add `order_kind`, `owner_id`, `priority`, `delivery_method` to `Order` interface
- Update the select query to include new fields

### 4B. Update `OrderList.tsx`

- Add `STATUS_COLORS` entries for all new statuses
- Add filter tabs or chips: "Extracts" vs "Commercial" (filter by `order_kind`)
- Add priority indicator (colored dot)
- Add status filter options for new statuses

### 4C. Update `OrderDetail.tsx`

- Show `order_kind` badge (Extract / Commercial)
- Show owner assignment (dropdown of profiles)
- Show priority selector
- Show delivery method selector
- Status dropdown uses expanded `ALLOWED_TRANSITIONS`
- Hard gate error messages surface in toast on mutation failure

### 4D. Update `AccountingOrders.tsx`

- No structural changes needed (passes through to OrderList/OrderDetail)

---

## Phase 5 — Automations (Edge Functions + DB Triggers)

### 5A. Auto-triage on order creation (trigger)

```sql
CREATE OR REPLACE FUNCTION auto_triage_new_order()
RETURNS trigger AS $$
BEGIN
  IF NEW.order_kind = 'extract' THEN
    IF NEW.customer_id IS NULL THEN
      NEW.status := 'needs_customer';
    ELSE
      NEW.status := 'needs_pricing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 5B. Auto-create delivery on `delivery_staged`

When order status becomes `delivery_staged` and `delivery_method = 'delivery'`, auto-insert a delivery record linked via `delivery_stops`.

### 5C. Auto-invoice on `delivered`

When order status becomes `delivered`, auto-advance to `invoiced` (or create QB invoice draft if QB is linked).

### 5D. SLA timers (cron or scheduled edge function)

- `needs_customer` > 2h → insert `activity_event` alert
- `needs_pricing` > 4h → alert estimator
- `quote_sent` > 48h → auto follow-up task

---

## Phase 6 — Four CEO Dashboards

### Dashboard 1: Extract Workbench

- Counts by status: needs_customer / needs_pricing / quote_ready / quote_sent
- Aging buckets (0-2h, 2-8h, 8-24h, 24h+)
- Pipeline $ = sum(expected_value) for active extracts

### Dashboard 2: Production Control

- WIP by phase (queued/cutting/bending/qc/ready) — data from `cut_plan_items`
- Machine utilization — from `machines` + `time_entries`
- Orders stuck in production > X hours

### Dashboard 3: Dispatch Control

- Staged awaiting scheduling
- Scheduled today
- Late deliveries
- Driver workload

### Dashboard 4: Cash Control

- Delivered not invoiced
- Invoiced not paid
- Average days to invoice
- AR aging from `qb_transactions`

---

## Implementation Order (Priority)

| Step | What | Type |
|------|------|------|
| 1 | Migration: add `order_kind`, `owner_id`, `priority`, `delivery_method` columns | DB |
| 2 | Migration: hard gate triggers (4 triggers) | DB |
| 3 | Migration: auto-triage trigger | DB |
| 4 | Migration: reclassify existing 28 orders | DB |
| 5 | Update `useOrders.ts` — expanded transitions + interface | Code |
| 6 | Update `OrderList.tsx` — new statuses, kind filter, priority dots | Code |
| 7 | Update `OrderDetail.tsx` — new fields, expanded status dropdown | Code |
| 8 | Delivery scheduling enforcement trigger | DB |
| 9 | Auto-create delivery on `delivery_staged` trigger | DB |
| 10 | Build 4 dashboard components | Code |
| 11 | SLA timer edge function | Code |
| 12 | Update MCP server with new tools for expanded statuses | Code |

### Technical Notes

- All gate triggers use `BEFORE UPDATE` on the relevant table
- The reclassification migration is idempotent (uses WHERE conditions)
- `ALLOWED_TRANSITIONS` will be enforced both client-side (UX) and server-side (triggers) for defense in depth
- Existing `block_production_without_approval` and `block_delivery_without_qc` triggers remain untouched
- No changes to `supabase/config.toml`, `client.ts`, or `types.ts`

