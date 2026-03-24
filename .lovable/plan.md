

## Train Forge: Comprehensive Shop Floor + Office Data & Reporting Tools

### Problem
Forge (Shop Floor Commander) can only see machine statuses and 15 active work orders. It has **one tool** (`update_machine_status`). When asked "what did you do today" or "show work orders," it correctly says "I cannot show you the work orders." It needs access to production data, machine runs, cut plans, inventory, timeclock, and office-relevant data to give comprehensive reports.

### Changes

**File: `supabase/functions/_shared/agentContext.ts`** — Expand shopfloor context block

Add these queries inside the `agent === "shopfloor"` block:

1. **Today's machine runs** — `machine_runs` with operator profile join, started today
2. **Cut plans** — active `cut_plans` with status
3. **Cut plan items** — `cut_plan_items` in active phases + completed today
4. **Today's timeclock entries** — `timeclock_entries` for today (who's clocked in, hours)
5. **Inventory levels** — `inventory` low-stock items or recent consumption
6. **Orders with customer names** — expand work_orders query to join `orders(order_number, customers(name))` and increase limit to 50

**File: `supabase/functions/_shared/agentTools.ts`** — Add read tools for Forge

Add these tools when `agent === "shopfloor"`:

1. `get_production_report` — Fetches today's machine runs, pieces produced, operator activity summary
2. `get_work_orders` — Lists work orders with status, customer, priority (read-only)  
3. `get_cut_plan_status` — Shows cut plan progress (items completed vs total)
4. `get_timeclock_summary` — Who's clocked in, shift hours, breaks

**File: `supabase/functions/_shared/agentToolExecutor.ts`** — Implement tool executors

Add execution handlers for each new tool:
- `get_production_report`: Query `machine_runs` today with operator names, aggregate output_qty
- `get_work_orders`: Query `work_orders` joined with orders/customers, return formatted list
- `get_cut_plan_status`: Query `cut_plans` + `cut_plan_items` phase counts
- `get_timeclock_summary`: Query `timeclock_entries` for today

**File: `supabase/functions/_shared/agents/support.ts`** — Update Forge prompt

Expand the Forge section to instruct it to:
- Always check production data before answering "what happened today"
- Use `get_production_report` for daily summaries
- Report pieces produced, machine runs completed, operator assignments
- Include cut plan progress in daily briefings
- Reference timeclock data for who was working

**Deploy**: Redeploy `ai-agent` edge function

### Files Changed

| File | Change |
|---|---|
| `_shared/agentContext.ts` | Add machine_runs, cut_plans, cut_plan_items, timeclock to shopfloor context |
| `_shared/agentTools.ts` | Add 4 read tools for shopfloor agent |
| `_shared/agentToolExecutor.ts` | Implement 4 new tool executors |
| `_shared/agents/support.ts` | Update Forge prompt with reporting instructions |
| Deploy | Redeploy `ai-agent` |

