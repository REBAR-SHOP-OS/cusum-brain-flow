

# Plan: Connect Extract → Production → Delivery (End-to-End)

## Current State Analysis

The infrastructure (columns, FKs, triggers) largely exists but has critical wiring gaps:

1. **`manage-extract/index.ts` line 525**: Creates orders with `status: "pending"` instead of `"extract_new"`
2. **`manage-extract/index.ts` lines 599-619**: Creates production_tasks **without `order_id`** — the key missing link
3. **No `recompute_order_completion` function**: Nothing auto-transitions orders to `ready`/`delivery_staged` when all tasks complete
4. **`auto_create_delivery_on_staged` trigger (line 165)**: Creates delivery with `status: 'planned'` instead of `'staged'`
5. **No delivery→order status mirroring**: Delivery status changes don't propagate back to order
6. **UI gaps**: ShopControl doesn't group by order; DeliveryOps has no scheduling action

## Implementation Steps

### Step 1: Database Migration — Add `recompute_order_completion` + fix triggers

```text
┌──────────────────────────────────────────────────────────────┐
│  production_tasks UPDATE/INSERT                              │
│       ↓ (trigger)                                            │
│  recompute_order_completion(order_id)                        │
│       ↓                                                      │
│  all tasks complete? → order.status = 'delivery_staged'      │
│       │                  (if delivery_method='delivery')      │
│       │                  or 'ready' (if pickup)              │
│       ↓ (existing trigger)                                   │
│  auto_create_delivery_on_staged → delivery(status='staged')  │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  deliveries UPDATE                                           │
│       ↓ (new trigger)                                        │
│  mirror_delivery_to_order()                                  │
│       delivery.scheduled → order.status='scheduled'          │
│       delivery.in_transit → order.status='in_transit'        │  
│       delivery.delivered  → order.status='delivered'         │
└──────────────────────────────────────────────────────────────┘
```

SQL migration will:
- Create `recompute_order_completion(uuid)` function
- Create trigger `trg_recompute_on_task_change` on `production_tasks` AFTER INSERT/UPDATE
- Fix `auto_create_delivery_on_staged` to use `status='staged'` not `'planned'`
- Create `mirror_delivery_to_order()` trigger on `deliveries` AFTER UPDATE
- Add `production_tasks.phase` column (default `'queued'`) if not present

### Step 2: Fix `manage-extract/index.ts`

Two surgical fixes:
- **Line 525**: Change `status: "pending"` → `status: "extract_new"`, add `order_kind: "extract"`
- **Lines 599-619**: Add `order_id: order.id` to each production task

### Step 3: Fix `convert-quote-to-order/index.ts`

- **Line 115**: Change `status: "pending"` → `status: "approved"`, add `order_kind: "commercial"`

### Step 4: Update ShopControl dashboard

- Query production_tasks with `order_id` join to orders (order_number, customer)
- Group tasks by order with completion percentage
- Add phase column display instead of just status

### Step 5: Update DeliveryOps page

- Show `order_number` and `customer_name` from joined order data
- Add scheduling action (set driver/vehicle/date → status='scheduled')
- Show `due_date` from linked order

### Step 6: Data backfill

- Run idempotent UPDATE to set `order_id` on orphaned production_tasks by matching through `work_orders.order_id`
- Fix any deliveries with `status='planned'` → `'staged'`

### Files Changed
- `supabase/migrations/new.sql` — recompute function, triggers, phase column
- `supabase/functions/manage-extract/index.ts` — add order_id to tasks, fix status
- `supabase/functions/convert-quote-to-order/index.ts` — fix status
- `src/components/dashboards/ShopControl.tsx` — order grouping + completion %
- `src/pages/DeliveryOps.tsx` — scheduling action + order info

