

# Fix: Show All Active Projects in Cutter Station

## Problem
The cutter station only shows "Alain Dubreuil" with 59 items because the BRONTE CONSTRUCTION project has bar sizes (20M+) that are routed to Cutter-02, not Cutter-01. The machine capability filter correctly excludes those items, but the user wants to see ALL active projects listed — even ones with zero compatible items for this machine — so operators have full visibility.

## Approach
Fetch active work orders separately in `StationView.tsx` and merge them into the customer-grouped view. Projects with no compatible items show as collapsed sections with a "0 items for this machine" indicator.

## Changes: `src/pages/StationView.tsx`

1. **Add a query for active work orders** — Fetch from `work_orders` joined with `orders.customers.name`, filtered to active statuses (`in_progress`, `pending`, `on_hold`). This gives us the full list of active projects with customer names.

2. **Merge into `customerGroupedData`** — After building groups from cut_plan_items, iterate active work orders. For any customer not already present in the grouped data, add an empty entry with `totalItems: 0` and an empty barlists array. This ensures BRONTE CONSTRUCTION appears even with no compatible bars.

3. **Render empty project sections** — For customers with 0 items, show a muted "No compatible items for this machine" message inside the collapsible, so the operator knows the project exists but has no work here.

### Visual Result
```text
┌─────────────────────────────────────┐
│ 🏢 Alain Dubreuil               ▼  │
│  59 ITEMS · 1 BARLIST               │
│  ├─ 📋 sdsfsd (Small)              │
│  │   └─ 10M [cards...]             │
│  │   └─ 15M [cards...]             │
├─────────────────────────────────────┤
│ 🏢 BRONTE CONSTRUCTION          ▼  │
│  0 ITEMS · ROUTED TO OTHER MACHINE  │
│  (No compatible items)              │
└─────────────────────────────────────┘
```

### Files Modified
- `src/pages/StationView.tsx` — add work orders query + merge into grouped data

