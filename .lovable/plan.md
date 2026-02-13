

# Swap Office and Production in Sidebar

## What Changes

In `src/components/layout/AppSidebar.tsx`, swap the order of the two nav groups in the `navGroups` array (lines 83-100) so **Office** appears first and **Production** appears second.

## Technical Details

### File Modified (1)

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Reorder `navGroups` array: move the "Office" group (Dashboard, CEO Portal, Pipeline, Customers, Accounting) above the "Production" group (Shop Floor, Office Tools) |

Current order:
1. Production (Shop Floor, Office Tools)
2. Office (Dashboard, CEO Portal, Pipeline, Customers, Accounting)

New order:
1. Office (Dashboard, CEO Portal, Pipeline, Customers, Accounting)
2. Production (Shop Floor, Office Tools)

