

# Group Cutter Queue by Customer → Barlist

## Current State
Items are grouped by `project_id` with `BarSizeGroup` inside each project. The user wants grouping by **customer name** first, then by **barlist** (cut plan) within each customer.

## Data Available on StationItem
- `customer_name` — from joined `projects.customers.name`
- `cut_plan_id` / `plan_name` — the barlist identity
- `project_name` — work order / project label

## Changes: `src/pages/StationView.tsx`

### Replace `projectGroupedData` with `customerGroupedData`

New hierarchy:
```text
┌─────────────────────────────────────┐
│ 🏢 BRONTE CONSTRUCTION          ▼  │
│  ├─ 📋 Barlist: CUT-PLAN-A         │
│  │   └─ 10M [card] [card]          │
│  │   └─ 15M [card]                 │
│  ├─ 📋 Barlist: CUT-PLAN-B         │
│  │   └─ 10M [card]                 │
├─────────────────────────────────────┤
│ 🏢 ALAIN DUBREUIL               ▼  │
│  ├─ 📋 Barlist: CUT-PLAN-C         │
│  │   └─ 10M [card] [card] [card]   │
└─────────────────────────────────────┘
```

### Logic
1. `useMemo` iterates `filteredGroups`, splits items by `customer_name` → then by `cut_plan_id`
2. Each customer is a `Collapsible` (defaultOpen)
3. Inside each customer, each barlist is a sub-`Collapsible` with `plan_name` as header
4. Inside each barlist, render `BarSizeGroup` components filtered to that barlist's items

### Rendering Structure
- Customer header: company icon + customer name + item count + chevron
- Barlist header: list icon + plan name + project name badge + item count
- Bar size groups: existing `BarSizeGroup` component unchanged

### Single file edit
Only `src/pages/StationView.tsx` changes. No hook, component, or backend changes needed.

