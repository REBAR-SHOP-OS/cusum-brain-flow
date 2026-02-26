

## Plan: Surface Production Queue on Station Dashboard

### Problem
The Production Queue (Customer → Projects → Barlists) only exists in the Office view. The Station Dashboard references it ("Active jobs appear in the Production Queue above") but never actually displays it. Operators on the shop floor can't see queued barlists like "1000197066 ONTARIO INC."

### Solution
Add a simplified Production Queue section to the Station Dashboard, positioned above the Work Order Queue, showing the same Customer → Project → Barlist hierarchy that exists in the Office view.

### Changes

**1. Create `src/components/shopfloor/ShopFloorProductionQueue.tsx`**
- New lightweight component that queries `barlists` joined with `projects` and `customers`
- Groups by customer → project → barlist (same hierarchy as Office `ProductionQueueView`)
- Shows barlist name, revision, and status
- Collapsible customer/project groups
- Links barlists to relevant station actions (e.g. navigate to optimize or assign)
- Uses existing `useBarlists` and `useProjects` hooks

**2. Update `src/pages/StationDashboard.tsx`**
- Import and render `ShopFloorProductionQueue` between `MaterialFlowDiagram` and `ActiveProductionHub`
- Pass through any needed props

### Files
- `src/components/shopfloor/ShopFloorProductionQueue.tsx` — new component
- `src/pages/StationDashboard.tsx` — add the new section

