

# Make Domain Metrics Clickable to Show Detail Lists

## Problem
In the Agent Report Dialog, domain metrics like "Total Orders: 75" and "Pending: 11" only show counts. The user wants to click on them and see the actual records behind those numbers.

## Approach
Add a drill-down panel inside the AgentReportDialog. When a domain metric is clicked, fetch and display the actual records in a collapsible list below the metric grid.

### 1. Create `useAgentDomainDrilldown` hook
- New file: `src/hooks/useAgentDomainDrilldown.ts`
- Accepts `agentCode` + `metricLabel` (e.g., `"legal"` + `"Total Orders"`)
- Fetches the actual records based on the agent/metric combination:
  - **Tally / "Total Orders"**: fetch all orders (order_number, customer name, status, date) 
  - **Tally / "Pending"**: fetch orders where `status = 'pending'`
  - **Blitz / "Active Leads"**: fetch leads in active stages (name, stage, date)
  - **Blitz / "Hot Enquiries"**: fetch leads where `stage = 'hot_enquiries'`
  - **Penny / "Unpaid Invoices"**: fetch sales_invoices in draft/sent/overdue
  - **Penny / "Open AR"**: fetch accounting_mirror with balance > 0
  - **Forge / "Active Cut Plans"**: fetch cut_plans in pending/in_progress
  - And so on for each agent's metrics
- Returns `{ data, isLoading }` — data is an array of `{ label: string; sublabel?: string; status?: string }`

### 2. Update `AgentReportDialog` — Domain Metrics section
- Make each metric card clickable (cursor-pointer, hover highlight)
- On click, set `selectedMetric` state
- Below the metrics grid, render a drilldown panel showing the fetched records
- Each record row shows: primary label (e.g., order number / lead name), sublabel (customer/date), and status badge
- Add a "close" button or click-to-toggle behavior

### 3. Scope
- 1 new file: `useAgentDomainDrilldown.ts`
- 1 modified file: `VizzyBrainPanel.tsx` (AgentReportDialog section, ~lines 1536-1550)
- No DB changes

