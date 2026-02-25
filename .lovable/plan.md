

## Multi-Project Parallel Pipeline Audit: New Bugs Found

After tracing 10 parallel projects running simultaneously across different machines from extraction through delivery and the driver UI, here are all new bugs beyond the 17 already fixed.

---

### CRITICAL — Race conditions and data corruption in multi-project parallel execution

#### 1. `QueueToMachineDialog`: does NOT set `machine_id` on the `cut_plans` row

**File**: `src/components/cutter/QueueToMachineDialog.tsx` line 78

```typescript
await supabase.from("cut_plans").update({ status: "queued" }).eq("id", plan.id);
```

Only `status` is updated — `machine_id` is never set. The cutter station query in `useStationData` (line 76) filters by `.eq("machine_id", machineId)`. Since `machine_id` stays `NULL`, the plan's items **never appear** on the cutter station.

The `machine_runs` rows ARE created with the correct `machine_id`, but cut_plan_items are fetched via `cut_plans.machine_id`, not via `machine_runs`. This means:
- Office queues a plan to Machine A → plan status becomes "queued"
- Cutter operator opens Machine A station → sees nothing (plan's `machine_id` is still NULL)
- With 10 projects queued in parallel, NONE appear on any station

**Fix**: Change line 78 to:
```typescript
await supabase.from("cut_plans").update({ status: "queued", machine_id: machineId }).eq("id", plan.id);
```

---

#### 2. `useStationData` realtime: channel name collision across projects

**File**: `src/hooks/useStationData.ts` line 122

```typescript
.channel(`station-${machineId}`)
```

The channel name uses only `machineId`. When `StationView` calls `useStationData(machineId, machineType, null)` (line 26 — no project filter to get ALL items for project selection), and then the filtered items are computed client-side, the **single** realtime channel correctly invalidates. However, the query key includes `projectId`:

```typescript
queryKey: ["station-data", machineId, machineType, companyId, projectId]
```

The invalidation at line 125 also includes `projectId`. So the channel invalidates only the `projectId=null` query. If a user navigates back, selects a different project, the old subscription's invalidation targets the wrong key. Items won't auto-refresh until the component remounts.

**Fix**: Remove `projectId` from the invalidation query key or use partial key matching:
```typescript
queryClient.invalidateQueries({ queryKey: ["station-data", machineId] })
```

---

#### 3. `StationView` project picker uses `project_name` string as ID — collisions across plans

**File**: `src/pages/StationView.tsx` lines 37-53

```typescript
const projKey = item.project_name || "__unassigned__";
```

Projects are keyed by their `project_name` string, not by a UUID `project_id`. If two different projects have the same name (e.g., two "123 Main St" projects from different customers), they merge into one entry. The operator sees combined items from both projects, which can cause mixed barlists loaded onto the same truck.

With 10 projects in parallel, name collisions become statistically likely.

**Fix**: Use `cut_plans.project_id` (available via the join) as the key instead of `project_name`. This requires adding `project_id` to the `cut_plans` select in `useStationData` and the `StationItem` type.

---

#### 4. `useDeliveryActions`: delivery number race condition in parallel creation

**File**: `src/hooks/useDeliveryActions.ts` lines 22-29

```typescript
const { count } = await supabase
  .from("deliveries")
  .select("id", { count: "exact", head: true })
  .eq("company_id", companyId)
  .like("delivery_number", `${invoiceNumber}-%`);
const seq = String((count ?? 0) + 1).padStart(2, "0");
```

If two operators create deliveries for the same invoice number simultaneously (e.g., two trucks for the same project), both read `count=0` and both generate `INV-01`. The second insert succeeds (no unique constraint on `delivery_number`), creating duplicate delivery numbers. With 10 projects loading simultaneously, this is likely.

**Fix**: Add a unique constraint on `(company_id, delivery_number)` in the database, and retry with incremented seq on conflict.

---

#### 5. `autoDispatchTask`: queue position race condition

**File**: `supabase/functions/manage-extract/index.ts` lines 804-811

```typescript
const { data: posData } = await sb
  .from("machine_queue_items")
  .select("position")
  .eq("machine_id", bestMachine.id)
  .in("status", ["queued", "running"])
  .order("position", { ascending: false })
  .limit(1);
const nextPos = posData?.length ? posData[0].position + 1 : 0;
```

When 10 projects approve simultaneously, multiple `autoDispatchTask` calls read the same `nextPos` and insert at the same position. This creates duplicate positions, corrupting the queue order. The production operator sees items in random order.

**Fix**: Use a database sequence or `COALESCE(MAX(position), -1) + 1` inside a transaction, or use `ON CONFLICT` to resolve position collisions.

---

### HIGH — Multi-project data integrity

#### 6. `BenderStationView`: `items` passed from parent are NOT filtered by project

**File**: `src/pages/StationView.tsx` line 223

```typescript
<BenderStationView
  machine={machine}
  items={items}  // ← these are project-filtered items from line 64-70
```

Wait — `items` at line 64 IS filtered. But `items` is filtered by `selectedProjectId` using `project_name` string matching (Bug #3). If two projects share a name, the bender gets mixed items. Additionally, if `selectedProjectId` is `null` (user hasn't selected), ALL items from ALL projects are passed to the bender — the operator sees a merged list across projects.

**Impact with 10 parallel projects**: Bender operator can accidentally process items from the wrong project if they haven't selected a project, or if project names collide.

#### 7. `DriverDashboard`: delivery filtering uses `driver_name` string match, not user ID

**File**: `src/pages/DriverDashboard.tsx` line 105

```typescript
.eq("driver_name", myProfile!.full_name!)
```

If two drivers have the same `full_name` (e.g., two "John Smith" employees), they see each other's deliveries. With 10 parallel projects generating deliveries assigned to different drivers, name collisions cause cross-delivery visibility.

**Fix**: Use `driver_profile_id` (a UUID FK to profiles) instead of `driver_name` string matching.

#### 8. Delivery `status` never transitions to `in-transit`

**File**: `src/hooks/useDeliveryActions.ts` — the delivery is created with `status: "pending"` (line 40). There is no code anywhere that transitions it to `in-transit`. The `DriverDashboard` filters by `d.status === "in-transit"` (line 129) to find the active delivery. But no UI action ever sets this status.

The driver can only see deliveries in the "Today's Deliveries" list and tap "Mark Arrived" on individual stops, but the parent delivery stays "pending" forever. The "Active Delivery" highlight card never appears.

**Fix**: Add a "Start Delivery" button in `DriverDashboard` that updates the delivery status to `in-transit`. Also auto-transition to `delivered` when all stops are completed.

#### 9. `delivery_stops.order_id` is never set — `block_delivery_without_qc` trigger is bypassed

**File**: The `block_delivery_without_qc` trigger (DB function) checks:
```sql
SELECT EXISTS (
  SELECT 1 FROM delivery_stops ds
  JOIN orders o ON o.id = ds.order_id
  WHERE ds.delivery_id = NEW.id
    AND (o.qc_evidence_uploaded = FALSE OR o.qc_final_approved = FALSE)
) INTO _missing;
```

But `useDeliveryActions.ts` creates delivery stops WITHOUT `order_id` (line 68-76):
```typescript
.insert({
  company_id: companyId,
  delivery_id: delivery.id,
  stop_sequence: 1,
  status: "pending",
  address: siteAddress,
  // NO order_id
})
```

The `JOIN orders o ON o.id = ds.order_id` returns zero rows because `order_id` is NULL. The QC check is completely bypassed — unverified items can be delivered.

**Fix**: Resolve the `order_id` from the cut plan's work order chain: `cut_plan → work_order → order_id`, and set it on the delivery stop.

---

### MEDIUM — UX / functional issues in multi-project scenarios

#### 10. `LoadingStation`: bundle selection doesn't show project name distinctly

When 10 projects produce completed bundles simultaneously, the `ReadyBundleList` component displays bundles by `projectName` — but this is actually `cut_plans.project_name`, which is set to `session.name` during extract approval (line 556 of manage-extract). If operators used the same session name across projects, bundles are indistinguishable.

#### 11. `PODCaptureDialog`: no delivery-level status update after all stops complete

After the driver captures POD for the last stop, only the stop status is set to "completed". The parent delivery status stays "pending" (or "in-transit" if bug #8 is fixed). The office user sees the delivery as still in progress even though all stops are done.

**Fix**: After updating the stop, check if all stops for the delivery are "completed" and auto-update delivery status to "delivered".

#### 12. `CutterStationView`: `completedAtRunStart` snapshot is not machine-scoped

**File**: `src/components/shopfloor/CutterStationView.tsx` line 43

```typescript
const [completedAtRunStart, setCompletedAtRunStart] = useState<number | null>(null);
```

This state is per-component instance. If an operator navigates to a different item within the same cutter session (via prev/next), `completedAtRunStart` from the previous item's run persists. The next item's "effective completed" calculation uses the wrong base, showing incorrect progress.

This is especially problematic when running 10 projects in parallel — switching between items from different projects mid-run corrupts the count.

**Fix**: Reset `completedAtRunStart` and `slotTracker` when `currentItem.id` changes.

#### 13. `StationView`: `workspaceName` prop passes raw `selectedProjectId` string

**File**: `src/pages/StationView.tsx` line 264

```typescript
workspaceName={selectedProjectId && selectedProjectId !== "__unassigned__" ? selectedProjectId : undefined}
```

`selectedProjectId` is the `project_name` string (e.g., "123 Main St"), not a formatted display name. For bender stations, `selectedProjectId` could be any arbitrary text since it comes from `project_name`. This is cosmetic but confusing when 10 projects are active.

---

### Summary of Required Fixes (Priority Order)

| # | Severity | Fix | File |
|---|----------|-----|------|
| 1 | CRITICAL | Set `machine_id` on `cut_plans` when queuing to machine | `QueueToMachineDialog.tsx` line 78 |
| 2 | CRITICAL | Fix realtime invalidation to use partial query key | `useStationData.ts` line 125 |
| 3 | CRITICAL | Use `project_id` instead of `project_name` for project keying | `StationView.tsx` + `useStationData.ts` |
| 4 | CRITICAL | Add unique constraint on delivery numbers / handle race | `useDeliveryActions.ts` + DB migration |
| 5 | CRITICAL | Fix queue position race in autoDispatchTask | `manage-extract/index.ts` line 804 |
| 6 | HIGH | Set `order_id` on delivery stops to enable QC gate | `useDeliveryActions.ts` line 68 |
| 7 | HIGH | Use `driver_profile_id` instead of `driver_name` for filtering | `DriverDashboard.tsx` line 105 |
| 8 | HIGH | Add delivery status transitions (`in-transit`, `delivered`) | `DriverDashboard.tsx` + `PODCaptureDialog.tsx` |
| 9 | HIGH | Reset `completedAtRunStart` on item change | `CutterStationView.tsx` |
| 10 | MEDIUM | Auto-complete delivery when all stops done | `PODCaptureDialog.tsx` |
| 11 | MEDIUM | Show distinct project identifiers in loading station | `LoadingStation.tsx` |
| 12 | LOW | Fix `workspaceName` display | `StationView.tsx` |

### Most Urgent: Bug #1 — Plans never appear on cutter stations

Bug #1 (`QueueToMachineDialog` not setting `machine_id`) means **zero plans appear on any cutter station** after being queued from the office. This is the single most critical break in the entire pipeline — the factory floor sees empty queues despite the office having queued work. Every single project is affected.

