

# Collapse by Default, Auto-Expand Only Active/Running Sections

## Goal
All collapsible sections default to **closed**, except sections that contain **running/active** work — those auto-expand.

## Changes

### File 1: `src/components/shopfloor/MachineGroupSection.tsx`

**MachineGroupSection (line 46):**
- `useState(true)` → `useState(runningPlans.length > 0)`
- Machine group opens only if it has running plans.

**ProjectFolder (line 119):**
- `useState(true)` → `useState(variant === "running")`
- Project sub-folders expand only if they are in the "running" variant.

### File 2: `src/pages/StationView.tsx`

**Customer Collapsible (line 419):**
- `defaultOpen={true}` → `defaultOpen={cust.barlists.some(bl => bl.groups.some(g => g.straightItems.some(i => i.status === "running") || g.bendItems.some(i => i.status === "running")))}`
- Or simpler: check if any item in this customer's barlists has a running/active status. If no items are running → collapsed.

Need to verify the item status field:

Actually, the StationView groups items by customer → barlist → bar-size groups. The items don't have a "running" status at that level — running status is on **cut plans** managed in the production queue. So for StationView, the simplest correct approach: **default all to closed** (`defaultOpen={false}`), since the station view shows the cutting queue, not active status.

**Barlist Collapsible (line 443):**
- `defaultOpen={true}` → `defaultOpen={false}`

### File 3: `src/components/shopfloor/ShopFloorProductionQueue.tsx`

Already collapsed (lines 193, 228 use `useState(false)`). No change needed.

## Summary

| File | Component | Current | New |
|------|-----------|---------|-----|
| `MachineGroupSection.tsx` | MachineGroupSection (L46) | `useState(true)` | `useState(runningPlans.length > 0)` |
| `MachineGroupSection.tsx` | ProjectFolder (L119) | `useState(true)` | `useState(variant === "running")` |
| `StationView.tsx` | Customer collapsible (L419) | `defaultOpen={true}` | `defaultOpen={false}` |
| `StationView.tsx` | Barlist collapsible (L443) | `defaultOpen={true}` | `defaultOpen={false}` |

4 one-line changes across 2 files. Running sections auto-expand; everything else starts collapsed.

