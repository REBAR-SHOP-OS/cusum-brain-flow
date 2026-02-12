

## Polish Sprint v1 — Trust and Speed

### Current State (verified from DB)

- **Orders**: 15 pending -- endpoint working, data real
- **Machines**: 5 idle + 1 running -- endpoint working, data real
- **Deliveries**: 0 rows -- table exists, clean state (no deliveries in progress)
- **Production (cut_plan_items)**: 73 complete, 9 in clearance, 7 queued -- real workflow data
- **CEO Dashboard**: Already pulls all KPIs from real DB (health score, machine status, production progress, AR, pipeline, team clock-ins)

### What Needs Polish

The CEO dashboard is solid but has two gaps, and the MCP server has one remaining schema issue.

---

### 1. MCP Server: Fix `list_deliveries` schema drift

The `list_deliveries` tool likely has column mismatches (same pattern as the others we fixed). Need to verify and align the SELECT with the real `deliveries` table columns: `id, delivery_number, status, scheduled_date, driver_name, vehicle, notes, created_at, company_id`.

### 2. CEO Dashboard: Replace mock exceptions with real data

The exceptions workbench (`ExceptionsWorkbench`) currently renders hardcoded mock data from `mockData.ts`. This breaks trust -- a CEO sees fake "Invoice #4821 overdue 45 days" every time. Replace with real queries:

- **Overdue invoices**: Query `accounting_mirror` where `entity_type = 'Invoice'` and `balance > 0`
- **Idle machines**: Query `machines` where `status = 'idle'` (already fetched)
- **Queued production**: Surface `cut_plan_items` where `phase = 'queued'` count
- **Pending deliveries**: Already counted in metrics

### 3. CEO Dashboard: Add queued/in-progress/completed-today counters

The dashboard shows total pieces but not the operator-friendly breakdown you described:
- Queued count (items with `phase = 'queued'`)
- In-progress count (`phase = 'cutting'` or `phase = 'bending'`)
- Completed today (items completed in last 24h -- requires `updated_at` filter)
- Machines running vs idle (already shown but can be more prominent)

### 4. Status standardization audit

Verify all status enums are consistent across the codebase:
- `cut_plan_items.phase`: queued, cutting, cut_done, bending, clearance, complete
- `machines.status`: idle, running, blocked, down
- `orders.status`: pending (others?)
- `machine_runs.status`: queued, running, paused, blocked, completed, rejected, canceled

No mixed naming detected so far -- this is already clean.

---

### Technical Changes

**File: `supabase/functions/mcp-server/index.ts`**
- Verify and fix `list_deliveries` SELECT to match real columns
- Verify `list_time_entries` and `get_dashboard_stats` for any remaining drift

**File: `src/components/ceo/ExceptionsWorkbench.tsx`**
- Accept real exception data as props instead of importing `mockExceptions`
- Create a `useExceptions` hook or extend `useCEODashboard` to generate exception items from real DB queries

**File: `src/hooks/useCEODashboard.ts`**
- Add queries for: queued cut_plan_items count, items completed today
- Generate real exception items from: overdue invoices, idle machines, queued backlog
- Return these as part of `CEOMetrics`

**File: `src/components/office/CEODashboardView.tsx`**
- Pass real exceptions to `ExceptionsWorkbench`
- Add prominent queued/in-progress/completed-today summary row

**File: `src/components/ceo/mockData.ts`**
- Keep as fallback/demo data but stop importing it in production views

### No new tables or migrations needed
All data already exists in the database.

