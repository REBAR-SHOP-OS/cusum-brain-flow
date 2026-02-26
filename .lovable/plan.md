

## Final Multi-Project Parallel Test: Remaining Issues

After verifying all 34 previously-fixed bugs, here is the current state of the pipeline when running 10 projects in parallel from extract through delivery.

---

### Verified Fixed (All Working Correctly)

All previous fixes are confirmed working:
- `QueueToMachineDialog` sets `machine_id` on line 78
- `useStationData` realtime invalidation uses partial key `["station-data", machineId]`
- `StationView` uses `project_id` (UUID) for keying, not `project_name`
- `useDeliveryActions` has retry loop with `attempt` offset for delivery number races
- Delivery stops now include `order_id` (resolved from cut_plan -> work_order chain)
- `DriverDashboard` uses `or(driver_profile_id, driver_name)` for filtering
- `DriverDashboard` has "Start Delivery" button setting `in-transit`
- `DriverDashboard` has optimistic state update after start
- `PODCaptureDialog` auto-completes delivery when all stops terminal
- `StopIssueDialog` auto-completes delivery when all stops terminal (including failed)
- `CutterStationView` resets `completedAtRunStart` on item change
- `PoolView` limit raised to 2000
- DB trigger `block_delivery_without_qc` now checks `in-transit` (hyphen)
- `useCompletedBundles` filters `phase: "complete"` only
- `manage-extract` uses random offset for queue position

---

### Remaining Issue #1 -- MEDIUM: Status string inconsistency in edge functions and CEO dashboard

Three backend files still reference `in_transit` (underscore) instead of `in-transit` (hyphen):

| File | Line | Code |
|------|------|------|
| `supabase/functions/_shared/vizzyFullContext.ts` | 289 | `d.status === "in_transit"` |
| `supabase/functions/vizzy-context/index.ts` | 140 | `d.status === "in_transit"` |
| `src/hooks/useCEODashboard.ts` | 177 | `.in("status", ["pending", "in_transit", "loading"])` |

The DB trigger was fixed to use `in-transit`, and the frontend consistently uses `in-transit`. But these three files query/filter using `in_transit`, meaning:
- The Vizzy AI assistant reports 0 deliveries in transit (it never matches)
- The CEO dashboard pending deliveries count misses in-transit deliveries
- The MCP server documentation (line 187) still describes `in_transit` as a valid status

These are data display bugs, not pipeline-breaking, but they mean management dashboards show incorrect counts.

### Remaining Issue #2 -- MEDIUM: `completed_with_issues` status not handled in UI filters

`StopIssueDialog` and `PODCaptureDialog` now set delivery status to `completed_with_issues` when stops have failures. However:

- `DriverDashboard.tsx` line 131: `completedToday` only checks `"completed" || "delivered"` -- misses `completed_with_issues`
- `DriverDashboard.tsx` line 132: `pendingToday` excludes `"completed"` and `"delivered"` but not `completed_with_issues`, so these show as pending
- `Deliveries.tsx` line 217-219: `pendingDeliveries` filter doesn't exclude `completed_with_issues`
- `statusColors` maps in both `DriverDashboard` and `Deliveries.tsx` have no entry for `completed_with_issues`, so the badge renders with no styling

With 10 projects, any delivery with a failed stop gets stuck in the "Pending" section with no badge color.

### Remaining Issue #3 -- LOW: `BenderStationView` invalidation key includes `"bender"` but works via prefix

`BenderStationView.tsx` line 113 uses `["station-data", machine.id, "bender"]` for invalidation. This works correctly via TanStack Query prefix matching since the full key is `["station-data", machineId, "bender", companyId, projectId]`. Not a bug -- confirmed working.

### Remaining Issue #4 -- LOW: `useDeliveryActions` `order_id` picks arbitrary work order

When a cut plan has items from multiple work orders (possible in multi-project re-assignment scenarios), `limit(1).maybeSingle()` picks an arbitrary item's `work_order_id`. This is a design limitation, not a clear bug. The QC gate may check the wrong order. Fixing this properly requires resolving all distinct `order_id` values and creating one stop per order, which is a feature change rather than a bug fix.

---

### Summary

| # | Severity | Issue | Files |
|---|----------|-------|-------|
| 1 | MEDIUM | `in_transit` string in edge functions and CEO dashboard never matches `in-transit` | `vizzyFullContext.ts`, `vizzy-context/index.ts`, `useCEODashboard.ts` |
| 2 | MEDIUM | `completed_with_issues` status not handled in UI filters or badge colors | `DriverDashboard.tsx`, `Deliveries.tsx` |
| 3 | LOW | Bender invalidation key -- false positive, works correctly | N/A |
| 4 | LOW | `order_id` picks arbitrary work order -- design limitation | `useDeliveryActions.ts` |

### Pipeline Health Assessment

The pipeline is now functionally complete for multi-project parallel execution. All critical and high-severity bugs have been resolved. The two medium issues are display/reporting bugs:
- Issue #1 means the AI assistant and CEO dashboard show wrong in-transit counts
- Issue #2 means deliveries with failed stops show incorrectly in the driver's list

Both are straightforward string fixes. No data corruption, race conditions, or security bypasses remain.

### Recommended Fixes

**Issue #1**: Update three files to use `in-transit` consistently:
- `vizzyFullContext.ts` line 289: `d.status === "in-transit"`
- `vizzy-context/index.ts` line 140: `d.status === "in-transit"`
- `useCEODashboard.ts` line 177: `.in("status", ["pending", "in-transit", "loading"])`

**Issue #2**: Add `completed_with_issues` to UI handling:
- Add to `statusColors` maps in both `DriverDashboard.tsx` and `Deliveries.tsx`
- Include in `completedToday` filter: `|| d.status === "completed_with_issues"`
- Exclude from `pendingToday`/`pendingDeliveries` filters

