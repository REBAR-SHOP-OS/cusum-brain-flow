
# Give Architect (App Builder) Full Read + Write Powers

## Problem
The Architect agent at `/empire` can **find problems** via `diagnose_platform` but cannot **fix them directly**. It can only create fix requests in `vizzy_fix_requests` — essentially filing tickets instead of acting. Meanwhile, Jarvis (`admin-chat`) has full ERP read/write tools. Architect should have the same power.

## What's Missing

### ERP Read Tools (Architect has none of these)
- `list_machines` -- query machines with status filter
- `list_deliveries` -- query deliveries with status/date filter
- `list_orders` -- query orders with status filter
- `list_leads` -- query leads with status/score filter
- `get_stock_levels` -- query inventory levels

### ERP Write Tools (Architect has none of these)
- `update_machine_status` -- fix blocked/down machines
- `update_delivery_status` -- update delivery progress
- `update_lead_status` -- update pipeline leads
- `update_cut_plan_status` -- update production plans
- `create_event` -- log activity events

### WooCommerce Write Tools (Architect is missing these)
- `wp_update_product` -- fix product pricing, stock, descriptions
- `wp_update_order_status` -- update WooCommerce orders
- `wp_create_redirect` -- create 301 redirects
- `wp_create_product` -- create new products
- `wp_delete_product` -- remove products
- `wp_optimize_speed` -- run speed optimizations

## Fix Plan

### File: `supabase/functions/ai-agent/index.ts`

**1. Add ERP Read + Write tool definitions for the empire agent**

After the existing empire tools block (around line 5848), add all 10 ERP tools (5 read + 5 write) as additional tool definitions gated by `agent === "empire"`. These are cloned from Jarvis's definitions in `admin-chat`.

**2. Add ERP tool call handlers**

After the existing empire tool handlers (around line 6960), add handler logic for each new tool:
- `list_machines` -- query `machines` table via `svcClient`
- `list_deliveries` -- query `deliveries` table
- `list_orders` -- query `orders` table
- `list_leads` -- query `leads` table
- `get_stock_levels` -- query `inventory_stock` table
- `update_machine_status` -- update `machines` table
- `update_delivery_status` -- update `deliveries` table
- `update_lead_status` -- update `leads` table
- `update_cut_plan_status` -- update `cut_plans` table
- `create_event` -- insert into `activity_events` table

**3. Add missing WooCommerce write tool definitions**

Add `wp_update_product`, `wp_update_order_status`, `wp_create_redirect`, `wp_create_product`, `wp_delete_product`, and `wp_optimize_speed` to the empire agent's WordPress tools block (extending the existing array at line 6050).

**4. Add WooCommerce write tool handlers**

Extend the existing WordPress tool handler block (around line 6370) to handle the new WP write tools using the shared `WPClient`.

**5. Update the system prompt**

Update the Architect system prompt (line 2256 area) to tell the AI it has **direct** ERP read/write tools, not just "create fix requests":

```
### ERP Fixes:
- Use list_machines, list_deliveries, list_orders, list_leads, get_stock_levels to READ current state
- Use update_machine_status, update_delivery_status, update_lead_status, update_cut_plan_status to FIX issues directly
- Use create_event to log what you fixed
- Create fix requests in vizzy_fix_requests only for issues requiring human/code changes
```

## Safety

All write tools follow the same safety pattern as Jarvis:
- The AI must describe the change and get user confirmation before calling write tools
- The system prompt instructs "Requires user confirmation" on all write tool descriptions
- Activity events are logged for all writes

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Add 10 ERP tools (definitions + handlers), 6 WP write tools (definitions + handlers), update system prompt |
