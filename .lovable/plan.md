

# Fix Build Error + ERP API Data Integrity

## 1. Build Error (blocking)

The PWA workbox `maximumFileSizeToCacheInBytes` is set to `5 * 1024 * 1024` (5,242,880 bytes) but the main bundle is 5,368,048 bytes — just over. Increase to 6 MiB.

**File**: `vite.config.ts` line 64
```
maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
```

## 2. MCP `list_production_tasks` — query `production_tasks` directly

Currently queries `cut_plan_items` which has no `order_id`. The `production_tasks` table already has `order_id` (added in migration). Replace the query to read from `production_tasks` with `order_id, cut_plan_id, cut_plan_item_id` in SELECT.

**File**: `supabase/functions/mcp-server/index.ts` lines 106-130

New query:
```
.from("production_tasks")
.select("id, order_id, cut_plan_id, task_type, bar_code, cut_length_mm, qty_required, qty_completed, status, mark_number, drawing_ref, asa_shape_code, priority, created_at")
```
Filter by `status` instead of `phase`.

## 3. Backfill production_tasks.order_id (existing orphaned rows)

The `manage-extract` code already sets `order_id` (line 603), so new tasks are fine. For legacy rows missing `order_id`, run a backfill joining through `cut_plan_items` → `cut_plans` → `work_orders` → `orders`:

```sql
UPDATE production_tasks pt
SET order_id = o.id
FROM cut_plan_items cpi
JOIN cut_plans cp ON cpi.cut_plan_id = cp.id
JOIN work_orders wo ON wo.id = cpi.work_order_id
JOIN orders o ON o.work_order_id = wo.id
WHERE pt.cut_plan_item_id = cpi.id
  AND pt.order_id IS NULL;
```

## 4. Backfill deliveries.order_id

```sql
UPDATE deliveries d
SET order_id = o.id
FROM orders o
WHERE o.status IN ('delivery_staged','ready','delivered')
  AND d.order_id IS NULL
  AND d.company_id = o.company_id;
```

## 5. Status backfill: pending → extract_new

Re-run (idempotent):
```sql
UPDATE orders SET status = 'extract_new' WHERE status = 'pending';
UPDATE deliveries SET status = 'staged' WHERE status = 'planned';
```

## Files Changed
- `vite.config.ts` — increase workbox limit to 6 MiB
- `supabase/functions/mcp-server/index.ts` — rewrite `list_production_tasks` to query `production_tasks` table directly
- Data backfills via insert tool (3 operations)

