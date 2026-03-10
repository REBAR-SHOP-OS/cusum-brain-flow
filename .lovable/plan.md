

# Show Production Queues Separated by Project in Cutter Station

## Problem
Currently the cutter station forces the operator to pick ONE project before seeing items. The user wants to see all projects' queues simultaneously, separated into distinct project sections — so operators can see the full picture without switching.

## Approach
Replace the forced project picker gate with an inline project-grouped layout. Items are grouped by `project_id` under collapsible project headers, while still allowing optional filtering via the existing project dropdown in the header.

## Changes

### 1. `src/pages/StationView.tsx` — Remove forced project picker gate, add project-grouped rendering

- **Remove** the early-return project picker block (lines 167-213) that blocks the UI when multiple projects exist
- **Auto-select** logic stays but defaults to `null` (show all) when multiple projects exist
- **Replace** the flat `filteredGroups.map(...)` rendering (lines 393-411) with a **project-grouped layout**: loop over distinct projects, render a collapsible section per project containing its bar-size groups
- Keep the header project dropdown for optional filtering (already wired)
- Keep barlist selector as-is (filters within the visible groups)

### 2. New helper: group items by project inside the production tab

In the production tab's cutter branch, instead of rendering `filteredGroups` flat:

```text
┌─────────────────────────────────┐
│ 📂 WO-MMKFDJFV (BRONTE)    ▼   │
│  ├─ 10M  [card] [card]         │
│  └─ 15M  [card]                │
├─────────────────────────────────┤
│ 📂 WO-MMKJQ8T4 (Alain D.)  ▼  │
│  ├─ 10M  [card] [card] [card]  │
│  └─ 12M  [card]                │
└─────────────────────────────────┘
```

Each project section is a collapsible `<Collapsible>` with the project/WO name as header, containing the existing `<BarSizeGroup>` components filtered to that project.

### 3. Adjust `useEffect` for auto-select

- When only 1 project: auto-select it (existing behavior)
- When multiple projects: set `selectedProjectId` to `null` (show all grouped)

### Files Modified
- `src/pages/StationView.tsx` — main change (remove gate, add grouped rendering)

### Safety
- No changes to `CutterStationView`, `useStationData`, or any hooks
- The focused cutter view (when clicking a card) still receives project-filtered items
- Existing barlist filtering, needs-fix tab, bender flow all untouched

