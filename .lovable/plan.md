
# Plan: Connect Extract → Production → Delivery (End-to-End)

## ✅ COMPLETED

All steps implemented:

### Step 1: Database Migration ✅
- `recompute_order_completion(uuid)` function — auto-transitions orders to `ready`/`delivery_staged` when all tasks complete
- `trg_recompute_on_task_change` trigger on `production_tasks` AFTER INSERT/UPDATE
- Fixed `auto_create_delivery_on_staged` to use `status='staged'`
- `mirror_delivery_to_order()` trigger — syncs delivery status → order status

### Step 2: Fix manage-extract ✅
- Line 525: `status: "extract_new"`, `order_kind: "extract"`
- Line 599: Added `order_id: order.id` to production tasks

### Step 3: Fix convert-quote-to-order ✅
- Status: `"approved"`, `order_kind: "commercial"`

### Step 4: ShopControl dashboard ✅
- Groups tasks by order with completion %
- Shows phase counts grid

### Step 5: DeliveryOps page ✅
- Shows `order_number` from joined order data
- Schedule dispatch dialog (driver/vehicle/date → status='scheduled')
- Shows `due_date` from linked order

### Step 6: Data backfill ✅
- `planned` deliveries → `staged`
- `pending` orders → `extract_new`
- Backfilled `order_id` on orphaned production_tasks via work_orders
