

## Disable "Record Stroke" When Project Is Paused

### Problem
When a project is paused mid-run, the "Record Stroke" button in the Cutter Station View remains active. The `useStationData` hook filters out paused projects on refetch, but items already loaded in `CutterStationView` remain interactive until they disappear from the list.

### Approach
Since items from paused projects will eventually be filtered out by the data hook, the safest approach is to **detect the paused state in real-time** and disable all write actions while the project is paused. This requires:

1. Carrying the project status through the data layer
2. Checking it in the station views and disabling write actions

### Changes

**1. `src/hooks/useStationData.ts` -- Expose project status on each item**
- Add `project_status: string | null` to the `StationItem` interface
- In both the bender and cutter query paths, map `projects.status` into the returned items as `project_status`

**2. `src/components/shopfloor/CutterStationView.tsx` -- Disable actions when paused**
- Derive `isProjectPaused` from `currentItem.project_status === 'paused'`
- Compute `effectiveCanWrite = canWrite && !isProjectPaused`
- Pass `effectiveCanWrite` instead of `canWrite` to `SlotTracker` and `CutEngine`
- Show a "PROJECT PAUSED" banner above the slot tracker when paused, so the operator understands why buttons are disabled

**3. `src/components/shopfloor/BenderStationView.tsx` -- Same treatment**
- Derive `isProjectPaused` from the current item's `project_status`
- Disable write actions when paused
- Show a paused banner

### What This Disables When Paused
- "Record Stroke" button (via `canWrite={false}` on SlotTracker)
- "Complete Run" button
- "Confirm Removed" button (bar removal)
- "LOCK and START" button (via CutEngine)
- Bender station actions

### Visual Indicator
A warning banner will appear at the top of the operator instructions panel:
```
WARNING: PROJECT PAUSED -- Recording disabled. Contact supervisor.
```

### No Database Changes
All changes are frontend-only. The existing `projects.status` column and `useStationData` join already provide the data -- we just need to surface it to the UI.
