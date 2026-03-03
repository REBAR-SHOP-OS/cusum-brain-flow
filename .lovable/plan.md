

# Fix MCP Server ERP API Output

## Root Cause

The MCP server edge function (`supabase/functions/mcp-server/index.ts`) has three problems:

1. **`list_production_tasks`** (line 119): Queries `cut_plan_items` table — NOT `production_tasks`. Also missing `order_id` in SELECT.
2. **`list_orders`** (line 173): SELECT doesn't include `order_kind`, `delivery_method`, or `due_date`.
3. **`list_deliveries`** (line 199): SELECT doesn't include `order_id`.

Additionally, the PostgREST schema cache likely needs a reload (`NOTIFY pgrst, 'reload schema'`) and a data backfill must run on the production database.

## Build Error

The build logs show successful transformation of 4814 modules — the output is truncated, not errored. The actual build likely succeeds. I'll confirm by checking the UI files for type errors.

## Changes

### 1. Patch `supabase/functions/mcp-server/index.ts`

**`list_orders`** (line 173): Add `order_kind, delivery_method, due_date` to SELECT:
```
"id, order_number, customer_id, status, total_amount, order_kind, delivery_method, due_date, notes, created_at"
```

**`list_deliveries`** (line 199): Add `order_id` to SELECT:
```
"id, delivery_number, order_id, driver_name, vehicle, scheduled_date, status, notes, created_at"
```

**`list_production_tasks`** (line 119-121): Change table from `cut_plan_items` to also query `production_tasks`, and add `order_id` + `phase` to SELECT. The tool currently reads `cut_plan_items` — we should either:
- Option A: Keep reading `cut_plan_items` but add `order_id` (via cut_plans → orders join or direct column)
- Option B: Add a second query for `production_tasks` with `order_id`

Since `cut_plan_items` has `phase` and production data, and `production_tasks` has `order_id`, the cleanest fix is to add `order_id` to the `cut_plan_items` SELECT (the column exists via the migration) AND also select from `production_tasks`. I'll keep the existing `cut_plan_items` query but add `order_id` to the select list, plus add the `cut_plans!inner(order_id)` join.

### 2. Database: Reload PostgREST schema cache

Run migration with `NOTIFY pgrst, 'reload schema';` to ensure the API layer sees new columns.

### 3. Data backfill (production)

Run idempotent UPDATE on production database:
- `orders` with `status = 'pending'` → `'extract_new'`
- `deliveries` with `status = 'planned'` → `'staged'`

### Files Changed
- `supabase/functions/mcp-server/index.ts` — 3 SELECT patches
- New migration — `NOTIFY pgrst, 'reload schema'`
- Data backfill via insert tool on production

