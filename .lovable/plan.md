# Dashboard v2 — Design Recommendation

A unified **Command Center** shell with **8 role-specific dashboards**. Same skeleton, different payload — so muscle memory transfers across departments while each role sees only what drives their decisions.

## Visual System (locked)

- **Palette — Navy Trust:** `#0f1b3d` (canvas) · `#1e3a5f` (panels) · `#3b6fa0` (accent/data) · `#e8edf3` (text). Status colors layered on top: emerald (good), amber (watch), coral (blocker).
- **Type:** Inter Tight for headings, Inter for body, JetBrains Mono for numbers (with `tabular-nums`).
- **Density:** Enterprise — 12px base spacing, 1px hairline dividers, soft inner shadows (no neumorphism, no glass).
- **Motion:** Numbers tick (count-up), panels fade-slide in, no decorative animation. Everything <200ms.

## Shell Architecture

```text
┌──────────────────────────────────────────────────────────┐
│  TopBar: Role switcher · Date range · Search · Alerts·You│
├──────┬───────────────────────────────────────────────────┤
│      │  ROW 1 — STATUS STRIP (KPI tiles, glanceable)     │
│ Side │ ─────────────────────────────────────────────────  │
│ Nav  │  ROW 2 — ACTION QUEUE (left)  │  PULSE (right)    │
│      │  what needs me NOW            │  live feed/chart  │
│      │ ─────────────────────────────────────────────────  │
│      │  ROW 3 — DRILLDOWN PANELS (collapsible)           │
└──────┴───────────────────────────────────────────────────┘
```

- **Left sidebar:** collapsible icon rail (your current pattern) — keeps cross-module nav.
- **Role switcher** in top-bar for users with multiple hats (GM, CEO).
- Every dashboard = **Status strip → Action queue → Drilldowns**. Same rhythm, different data.

---

## Per-Department Dashboards

### 1. CEO — *Business Heartbeat*
- **Status strip:** Cash position · MTD revenue · Open AR · Production throughput · Active alerts
- **Action queue:** Approvals waiting on you · SMS-throttled alerts · Plaid variance flags
- **Pulse:** Live order flow (sales → production → dispatch sankey) · 30-day cash chart
- **Drilldowns:** Department health cards (click → jump to that dept dashboard)

### 2. General Manager — *Operations Cockpit*
- **Status strip:** Orders today · On-time % · Shop utilization · Headcount on clock · Backlog days
- **Action queue:** Cross-dept blockers · SLA breaches · Stuck work orders >24h
- **Pulse:** Department leaderboard · Shift coverage map
- **Drilldowns:** Production flow gates · Delivery routes · Team status

### 3. Sales — *Pipeline Command*
- **Status strip:** Pipeline $ · Win rate · Quotes pending · Hot leads · Calls today
- **Action queue:** Stale leads (>5d) · Quotes awaiting customer · Follow-ups due · Blitz Agent zero-price recoveries
- **Pulse:** Pipeline stage funnel · Recent activity stream
- **Drilldowns:** Top customers · Lost-reason analysis · Lead-scoring tray

### 4. Marketing — *Content & Reach*
- **Status strip:** Posts scheduled · Neel approval queue · 5-slot daily progress · SEO clicks 7d · CTR
- **Action queue:** Drafts needing approval · Campaign drift alerts · Wincher rank drops
- **Pulse:** Multi-platform calendar strip · GSC trend
- **Drilldowns:** Per-platform performance · SEO findings (ai@rebar.shop) · Email campaign stats

### 5. Estimation / Office — *Extract Workbench*
- **Status strip:** PDFs in queue · Extracts done today · Avg extract time · Unit-detection accuracy · Sanity-check flags
- **Action queue:** Failed extractions · Imperial conversion warnings · Plans pending detailed list
- **Pulse:** Extraction throughput chart · AI cost meter
- **Drilldowns:** Detailed list · Production queue handoff · Order Calculator

### 6. Shop Floor — *Production Cockpit* (large-display friendly)
- **Status strip:** Active stations · Tons cut today · Clearance queue · Loading queue · Idle machines
- **Action queue:** Quality holds · Cutter plan conflicts · Machine alarms · Material pool shortages
- **Pulse:** Station live feed (cutting → clearance → loading flow) · Camera AI events
- **Drilldowns:** Per-machine runs · Bundle status · Waste bank
- *Note:* `tabular-nums` everywhere, 1.25x font scale for shop displays.

### 7. Accounting — *Cash Control*
- **Status strip:** Bank balance (Plaid) · AR aging · AP due 7d · Unmatched payments · Payroll next-run
- **Action queue:** 3-way match mismatches · QuickBooks sync errors · Tax tasks due · Variance flags
- **Pulse:** Cash-in vs cash-out 30d · Invoice status donut
- **Drilldowns:** Invoices · Payment sources · Payroll audit · Tax planning

### 8. R&D — *Experiments & Adoption*
- **Status strip:** Active experiments · Rollout % · Feature-flag count · Errors 24h · Edge-fn cost
- **Action queue:** Failing experiments · Flags stuck >30d · Security findings · DB linter warnings
- **Pulse:** Adoption curve per feature · Edge-function latency
- **Drilldowns:** Rollout registry · Architecture flow · Cron health

---

## Cross-Cutting Patterns

- **Status tile spec:** big number (mono), label, delta vs prior period, sparkline, click → drilldown filtered by that metric.
- **Action queue spec:** rows with severity dot, entity link, age, primary CTA inline (Approve / Open / Snooze). Empty state celebrates ("Zero blockers — ship it.").
- **Pulse spec:** one live chart or feed, subscribes via realtime channel (unique UUID per memory rule).
- **Personalization:** users can pin/reorder tiles in their own dashboard (stored per `user_id`, dual-scoping rule).
- **Permissions:** role-gated via `useUserRole` + `useSuperAdmin`; same shell, sections hide if role lacks access.

## Why this works for Rebar Shop

1. **Mirrors your real flow:** Sales → Estimation → Shop → Dispatch → Cash maps 1:1 to dashboard order.
2. **Hybrid status+action** matches how you actually run the business — you want to see health *and* know what to do.
3. **One shell, eight payloads** = low build/maintain cost, consistent UX, easy to add a 9th dept later.
4. **Navy Trust palette** signals authority/finance — right tone for ERP used by CEO + accounting daily.
5. **Respects existing architecture:** keeps your icon sidebar, role hooks, realtime patterns, timezone, and access overrides untouched.

## Technical Notes (for build phase)

- New route `/dashboard/v2` with role-aware default landing (CEO → CEO dashboard, etc.).
- Shared `<DashboardShell>` component with slots: `statusStrip`, `actionQueue`, `pulse`, `drilldowns`.
- Each dept = one file under `src/components/dashboards/v2/{role}Dashboard.tsx`, imported directly (no `React.lazy`).
- Reuse existing hooks: `useBusinessHeartbeat`, `useLiveMonitorStats`, `useStationData`, `useSalesLeads`, `useSocialPosts`, `useBankFeedBalances`, etc.
- Status tiles read from existing views (must be `security_invoker=true`).
- Persistence: tile pins in new `dashboard_preferences` table, RLS scoped by `user_id`.

---

**Next step:** Approve this plan and I'll start with the `<DashboardShell>` + CEO dashboard as the reference implementation, then roll the same pattern across the other 7 in order of priority you choose.
