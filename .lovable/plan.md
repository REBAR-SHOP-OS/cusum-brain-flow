

# Fix: Customer → Barlist Grouping Not Activating

## Root Cause
The auto-select logic (line 60) selects a project when there's only 1 project. Since all 59 items belong to one project, `selectedProjectId` gets set, which causes `customerGroupedData` to return `null` (line 140: `if (selectedProjectId) return null`). The UI then falls through to the flat layout instead of the grouped view.

## Fix

### `src/pages/StationView.tsx`

1. **Remove auto-select for single project** — Always default to `selectedProjectId = null` so the customer-grouped view is the default. The project dropdown remains available as an optional filter.

   Change the `useEffect` (lines 59-65): remove the `projects.length === 1` auto-select branch. Only keep the cleanup branch for stale selections.

2. **Always compute `customerGroupedData`** — Remove the `if (selectedProjectId) return null` guard (line 140). When a project IS selected, still group by customer/barlist but use the already-filtered `filteredGroups` (which respects `selectedProjectId`).

This way:
- Default view = all items grouped by Customer → Barlist → Bar Size
- Optional project filter via dropdown still works, but shows grouped layout too
- Single project or multiple projects — same consistent grouped UI

