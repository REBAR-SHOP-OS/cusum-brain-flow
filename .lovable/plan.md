

## Fix: Station View Showing Items From Other Stations

### Problem
When an operator opens a cutter station (e.g., CUTTER-01), they see items that belong to other stations too. This happens because the `useStationData` query for cutters includes a `machine_id.is.null` clause -- meaning **every unassigned cut plan shows up on every cutter station**.

Currently, all active cut plans in the database have `machine_id = NULL`, so every single item appears on every cutter. The only separation today is a hardcoded bar-size filter (`CUTTER_DISTRIBUTION`) that splits items by diameter (10M/15M to CUTTER-01, 20M+ to CUTTER-02), but this is fragile and doesn't enforce true station isolation.

### Root Cause
In `src/hooks/useStationData.ts`, line 93:
```
.or(`machine_id.eq.${machineId},machine_id.is.null`)
```
The `machine_id.is.null` part means any plan without a machine assignment appears on **all** cutters simultaneously.

### Solution

**File: `src/hooks/useStationData.ts`**

1. **Remove `machine_id.is.null` from the cutter query** -- Only show plans that are explicitly assigned to the current machine. This enforces strict station isolation: a plan must be assigned to a machine before it appears on that station.

2. **Remove the hardcoded `CUTTER_DISTRIBUTION` filter** -- This brittle UUID-based filter becomes unnecessary once plans are properly assigned per machine. Machine capabilities already track what each machine can handle.

3. **Keep the bender behavior unchanged** -- Benders intentionally show all bend items regardless of machine assignment (items flow to benders after cutting is done).

### What This Means for Workflow
- Plans must be assigned to a specific machine (via the office/planning interface) before they appear on a station
- Unassigned plans (`machine_id = NULL`) will no longer leak into every cutter station
- The existing project filter pills and bar-size grouping remain unchanged

### Technical Changes

| Change | Location | Detail |
|--------|----------|--------|
| Remove `machine_id.is.null` from cutter query | `useStationData.ts` line 93 | Change `.or(...)` to `.eq("machine_id", machineId)` |
| Remove `CUTTER_DISTRIBUTION` constant and `passesDistribution` function | `useStationData.ts` lines 42-56, 111 | Delete hardcoded UUID map and filter call |

