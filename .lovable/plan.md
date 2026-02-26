

## Final Multi-Project Parallel Test: Remaining Bugs

After reviewing all code changes from the previous 3 rounds of fixes (29 bugs fixed), here are the remaining issues found when simulating 10 projects running in parallel through the full pipeline.

---

### Previous Fixes Verified (Working Correctly)

The following previously-fixed areas are now correct:
- `QueueToMachineDialog` correctly sets `machine_id` on line 78
- `useStationData` realtime invalidation uses partial key `["station-data", machineId]`
- `StationView` uses `project_id` (UUID) for project keying, not `project_name`
- `useDeliveryActions` has retry loop for delivery number race conditions
- `manage-extract` reject handler includes `company_id` in event insert
- `manage-extract` approval correctly calculates `pieces_per_bar` and `qty_bars`
- `manage-extract` sets `project_id: projectId` (not `workOrder.id`) on production tasks
- `useCompletedBundles` filters only `phase: "complete"` items
- `auto_advance_item_phase` trigger accepts both `bending` and `cut_done` phases
- `CutterStationView` resets `completedAtRunStart` on item change
- `PODCaptureDialog` auto-completes delivery when all stops are done
- `DriverDashboard` has "Start Delivery" button and `driver_profile_id` support
- `LoadingStation` has `creating` guard against double-click

---

### NEW BUG #1 — CRITICAL: `block_delivery_without_qc` trigger uses `in_transit` but app writes `in-transit`

**File**: DB trigger (migration `20260213082259`) line 131 vs `DriverDashboard.tsx` line 160

The QC gate trigger checks:
```sql
IF NEW.status IN ('loading', 'in_transit') AND OLD.status NOT IN ('loading', 'in_transit') THEN
```

But the driver dashboard sets:
```typescript
.update({ status: "in-transit" })  // hyphen, not underscore
```

Since `'in-transit' != 'in_transit'`, the QC trigger **never fires**. The delivery transitions to "in-transit" without any QC check. The entire QC gate is completely bypassed for all deliveries.

With 10 parallel projects, every single delivery can be started without QC verification.

**Fix**: Either update the trigger to check `'in-transit'` (matching the app convention) or standardize all status values to use underscores. Since the app consistently uses `in-transit` (hyphen) across 3+ files, the trigger should be updated:
```sql
IF NEW.status IN ('loading', 'in-transit') AND OLD.status NOT IN ('loading', 'in-transit') THEN
```

---

### NEW BUG #2 — HIGH: `StopIssueDialog` does not trigger delivery auto-completion check

**File**: `src/components/delivery/StopIssueDialog.tsx` line 34-41

When a driver logs an issue on a stop, the stop status is set to `"failed"`. But no code checks whether all other stops are completed. If the last remaining stop fails, the delivery stays "in-transit" forever.

Example scenario with 10 projects: Driver has 3 stops. Stops 1 and 2 completed via POD. Stop 3 has an issue (customer not available). Stop 3 is marked `"failed"`. The delivery stays `"in-transit"` permanently because `PODCaptureDialog`'s auto-complete only checks when a stop is `"completed"`, not `"failed"`.

**Fix**: After marking a stop as failed, check if all stops have a terminal status (`completed` or `failed`) and auto-update the delivery to `delivered` (or a new `completed_with_issues` status).

---

### NEW BUG #3 — HIGH: Bender station `queryClient.invalidateQueries` uses wrong key format

**File**: `src/components/shopfloor/BenderStationView.tsx` line 113

```typescript
await queryClient.invalidateQueries({ queryKey: ["station-data", machine.id, "bender"] });
```

The query key in `useStationData` is `["station-data", machineId, machineType, companyId, projectId]`. The bender invalidation uses `["station-data", machine.id, "bender"]` which is a 3-element key. This works via prefix matching only because `machine.id` matches `machineId` at position 1.

However, `"bender"` at position 2 matches `machineType` at position 2. But `companyId` at position 3 is missing — so this prefix `["station-data", machine.id, "bender"]` will NOT match a query with key `["station-data", machine.id, "bender", "some-company-id", null]` because TanStack Query's prefix matching requires exact element equality for each position specified.

Wait — TanStack Query's `queryKey` filtering IS prefix-based: a partial key `["station-data", machine.id, "bender"]` matches any key that starts with those 3 elements. So `["station-data", machine.id, "bender", companyId, projectId]` IS matched. This is correct.

Actually, re-checking: the cutter already uses `["station-data", machine.id]` (2 elements) for invalidation. The bender uses 3 elements. Both work via prefix matching. This is not a bug — marking as **false positive**.

---

### NEW BUG #3 (revised) — MEDIUM: `DriverDashboard` does not update `selectedDelivery` after status change

**File**: `src/pages/DriverDashboard.tsx` line 157-163

When `handleStartDelivery` is called, it updates the DB but the local `selectedDelivery` state still has `status: "pending"`. The UI still shows the "Start Delivery" button (line 211 checks `selectedDelivery.status === "pending"`). The button disappears only after the realtime subscription fires and the query refetches, which can take 1-3 seconds.

During this window, if the operator double-taps, `handleStartDelivery` fires again — but since the status is already `"in-transit"`, the update is a no-op. This is not harmful but creates a confusing UX flash.

**Fix**: Optimistically update `selectedDelivery` state after successful mutation:
```typescript
const handleStartDelivery = async (deliveryId: string) => {
  await supabase.from("deliveries").update({ status: "in-transit" }).eq("id", deliveryId);
  setSelectedDelivery(prev => prev ? { ...prev, status: "in-transit" } : null);
  refreshStops();
};
```

---

### NEW BUG #4 — MEDIUM: `useDeliveryActions` `order_id` resolution can fail silently for multi-project

**File**: `src/hooks/useDeliveryActions.ts` lines 80-97

The `order_id` resolution chain is:
1. Get first `cut_plan_item` with non-null `work_order_id`
2. Get `work_orders.order_id`

But with multi-project parallel execution, if the cut plan has items from multiple work orders (possible when items are re-assigned), the `limit(1).maybeSingle()` picks an arbitrary item. Its `work_order_id` may resolve to an `order_id` for a different project's order. The QC gate then checks the wrong order.

This is a design limitation rather than a clear bug, but in multi-project scenarios it can cause incorrect QC validation — either blocking a valid delivery or allowing an invalid one.

---

### NEW BUG #5 — MEDIUM: `PoolView` not included in fix scope — still shows stale phase data

**File**: `src/pages/PoolView.tsx`

The PoolView (material flow overview) fetches items per phase with `ITEMS_LIMIT = 500`. With 10 parallel projects each having 50+ items, the 500-item limit means some phases may not show all items. The "clearance" and "complete" columns may appear empty even when items exist beyond the limit.

This was not addressed in any of the 3 fix rounds.

---

### Summary of Remaining Fixes

| # | Severity | Bug | File |
|---|----------|-----|------|
| 1 | CRITICAL | QC trigger uses `in_transit` but app writes `in-transit` — QC gate bypassed | DB trigger + all status references |
| 2 | HIGH | `StopIssueDialog` failed stops don't trigger delivery auto-completion | `StopIssueDialog.tsx` |
| 3 | MEDIUM | `DriverDashboard` optimistic state update missing after Start Delivery | `DriverDashboard.tsx` line 157 |
| 4 | MEDIUM | `order_id` resolution picks arbitrary work order in multi-project plans | `useDeliveryActions.ts` line 82 |
| 5 | MEDIUM | `PoolView` 500-item limit hides data in multi-project scenarios | `PoolView.tsx` |

### Overall Pipeline Health

After 3 rounds of fixes (29 bugs total), the pipeline is substantially more robust. The one remaining **critical** issue is Bug #1 — the status string mismatch between the database trigger (`in_transit`) and the application code (`in-transit`). This means the QC gate has never actually fired for any delivery. All other issues are medium severity or edge cases.

**Recommended action**: Fix Bug #1 (trigger status mismatch) and Bug #2 (failed stop auto-completion) as they are the only functional gaps remaining.

