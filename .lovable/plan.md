

## Plan: Add All Sidebar Menu Items to Architecture Diagram

### Current State
The sidebar has ~20 menu items across 5 categories (OFFICE, PRODUCTION, LOGISTICS, QA, SYSTEM). Only about half are represented in the architecture diagram.

### Missing Items (not yet in ARCH_NODES)

| Sidebar Item | Category | Proposed Layer | Connections |
|---|---|---|---|
| Dashboard | OFFICE | modules | Primary DB, Analytics, Realtime |
| Business Tasks | OFFICE | modules | Pipeline, State Machine, Approval Engine |
| Live Monitor | OFFICE | modules | Realtime, Monitoring, Shop Floor |
| CEO Portal | OFFICE | modules | Analytics, Primary DB, Pipeline |
| Support | OFFICE | modules | Chat, Haven agent, Notifications |
| Lead Scoring | OFFICE | modules | CRM, Pipeline, AI Gateway |
| Customers | OFFICE | modules | CRM, Primary DB |
| Sales | OFFICE | modules | CRM, Quotes, Pipeline, Blitz agent |
| Time Clock | PRODUCTION | modules | Team Hub, Kiosk, Payroll |
| Office Tools | PRODUCTION | modules | Primary DB, Storage |
| Inventory | LOGISTICS | modules | Shop Floor, Odoo, Kala agent |
| Diagnostics | QA | modules | Monitoring, Health Check, Error Track |
| Settings | SYSTEM | platform | Feature Flags, Secrets, Admin |
| Architecture | SYSTEM | platform | (self-reference, skip or add as doc node) |

**Already mapped:** Inbox, Team Hub, Accounting, Shop Floor, Pipeline (as AI node)

### Changes

**`src/lib/architectureGraphData.ts`**:
1. Add ~13 new nodes to the `modules` layer (and 1 to `platform`) with `orange` accent
2. Add ~35 new edges connecting these items to existing nodes (agents, integrations, platform)
3. Import any additional Lucide icons needed (LayoutDashboard, ListTodo, Monitor, Crown/Building, Headphones, Star, Users, Clock, Wrench, Package, Stethoscope, Settings)

**`src/lib/architectureFlow.ts`**:
- Increase `maxPerRow` from 12 to 14 (modules layer will now have ~25 nodes)

### New Nodes Detail

```text
// OFFICE additions
{ id: "dashboard",    label: "Dashboard",      hint: "Overview",     layer: "modules" }
{ id: "biz-tasks",    label: "Business Tasks", hint: "Task mgmt",    layer: "modules" }
{ id: "live-monitor", label: "Live Monitor",   hint: "Real-time",    layer: "modules" }
{ id: "ceo-portal",   label: "CEO Portal",     hint: "Executive",    layer: "modules" }
{ id: "support",      label: "Support",        hint: "Help desk",    layer: "modules" }
{ id: "lead-scoring", label: "Lead Scoring",   hint: "AI scoring",   layer: "modules" }
{ id: "customers",    label: "Customers",      hint: "Directory",    layer: "modules" }
{ id: "sales",        label: "Sales",          hint: "Revenue",      layer: "modules" }

// PRODUCTION additions
{ id: "time-clock",   label: "Time Clock",     hint: "Attendance",   layer: "modules" }
{ id: "office-tools", label: "Office Tools",   hint: "Utilities",    layer: "modules" }

// LOGISTICS
{ id: "inventory",    label: "Inventory",      hint: "Stock",        layer: "modules" }

// QA
{ id: "diagnostics",  label: "Diagnostics",    hint: "System health", layer: "modules" }

// SYSTEM
{ id: "settings",     label: "Settings",       hint: "Config",       layer: "platform" }
```

### Key Edges (examples)
- `dashboard` → `primary-db`, `analytics`, `realtime`
- `sales` → `crm`, `quotes`, `ag-blitz`
- `inventory` → `shop-floor`, `fn-odoo`, `ag-kala`
- `time-clock` → `team-hub`, `kiosk`, `payroll`
- `diagnostics` → `monitoring`, `health`, `error-track`
- `lead-scoring` → `crm`, `fn-ai`, `pipeline`
- `live-monitor` → `realtime`, `monitoring`, `shop-floor`
- `ceo-portal` → `analytics`, `primary-db`, `pipeline`

### Result
- Every sidebar menu item has a corresponding node in the diagram
- Single-clicking any item shows its connections
- Modules layer expands to ~25 nodes across 2 rows
- All existing nodes, edges, and interactions preserved

