

## Full Pipeline Audit: Extract → Delivery — New Bugs Found

After tracing every code path from AI extraction through cut planning, cutter/bender stations, clearance, loading, delivery creation, and driver POD capture, here are the additional bugs beyond the 6 already fixed.

---

### CRITICAL — Will cause runtime failures

#### 1. `manage-extract` reject handler: `company_id` missing from activity_events insert

**File**: `supabase/functions/manage-extract/index.ts` line 719

The `rejectExtract` function only selects `id, name, status` from the session (line 699):
```typescript
const { data: session } = await sb
  .from("extract_sessions")
  .select("id, name, status")  // ← no company_id
  .eq("id", sessionId)
  .single();
```

Then at line 719 it inserts an activity event WITHOUT `company_id`:
```typescript
await sb.from("activity_events").insert({
  entity_type: "extract_session",
  entity_id: sessionId,
  event_type: "rejected",
  // ... NO company_id
});
```

This will fail with a not-null constraint violation — the same bug class as the `manage-machine` fix already applied.

**Fix**: Add `company_id` to the session select, and include it in the event insert.

---

#### 2. `auto_advance_item_phase` trigger: bending completion only fires when phase is `bending` — but bender items may still be in `cut_done`

**File**: Migration `20260207210138` — trigger function

The trigger at line 21-25:
```sql
IF NEW.bend_completed_pieces >= NEW.total_pieces 
   AND NEW.total_pieces > 0
   AND NEW.phase = 'bending' THEN   -- ← ONLY fires if phase is already 'bending'
  NEW.phase := 'clearance';
END IF;
```

But the bender `handleDone` (correctly) no longer sets `phase: "bending"`. Items arrive at the bender with `phase = 'cut_done'`. When the operator completes all bending (bend_completed_pieces = total_pieces), the trigger checks `NEW.phase = 'bending'` — which is FALSE because the item is still in `cut_done`. The item **never advances to clearance**.

This means completed bend items remain stuck in `cut_done` forever, still visible on the bender station.

**Fix**: Update the trigger to also accept `cut_done`:
```sql
IF NEW.bend_completed_pieces >= NEW.total_pieces 
   AND NEW.total_pieces > 0
   AND NEW.phase IN ('bending', 'cut_done') THEN
  NEW.phase := 'clearance';
END IF;
```

---

### HIGH — Data integrity / functional gaps

#### 3. `manage-extract` approve: `pieces_per_bar` never calculated for cut_plan_items

**File**: `supabase/functions/manage-extract/index.ts` line 565-578

When creating `cut_plan_items` during approval:
```typescript
const cutItems = rows.map((row: any) => ({
  cut_plan_id: cutPlan.id,
  bar_code: row.bar_size_mapped || row.bar_size || "10M",
  qty_bars: row.quantity || 1,        // ← sets qty_bars = quantity (total pieces)
  cut_length_mm: row.total_length_mm || 0,
  total_pieces: row.quantity || 1,
  // pieces_per_bar is NOT set — defaults to DB default or null
}));
```

`qty_bars` is set to the row quantity (total pieces), but this should be bars needed, not pieces. `pieces_per_bar` is never calculated. The cutter station's Foreman Brain uses these values for run planning. With `qty_bars = total_pieces` and no `pieces_per_bar`, the run plan will compute incorrect bar counts.

**Fix**: Calculate `pieces_per_bar` from stock length and cut length:
```typescript
const stockLength = 12000; // default
const piecesPerBar = row.total_length_mm > 0 
  ? Math.floor(stockLength / row.total_length_mm) 
  : 1;
const qtyBars = Math.ceil((row.quantity || 1) / Math.max(piecesPerBar, 1));
```

#### 4. `manage-extract` approve: `production_tasks.project_id` is set to `workOrder.id` instead of actual `projectId`

**File**: `supabase/functions/manage-extract/index.ts` line 590

```typescript
const tasks = savedItems.map((item: any) => ({
  company_id: session.company_id,
  project_id: workOrder.id,          // ← BUG: this is work_order.id, not project_id
  work_order_id: item.work_order_id || workOrder.id,
}));
```

This means all production tasks have their `project_id` set to a work order UUID, breaking any project-based filtering or reporting.

**Fix**: Change to `project_id: projectId,`

#### 5. `useCompletedBundles`: includes `clearance` phase items — but these haven't passed QC yet

**File**: `src/hooks/useCompletedBundles.ts` line 37

```typescript
.in("phase", ["clearance", "complete"])
```

Items in `clearance` are awaiting QC verification. Including them in "completed bundles" at the Loading Station means operators can load items onto the truck before QC has signed off. The loading station then creates deliveries for unverified items.

**Fix**: Change to `.eq("phase", "complete")` only, or add a QC verification check.

#### 6. `useDeliveryActions`: delivery `cut_plan_id` set but not typed correctly

**File**: `src/hooks/useDeliveryActions.ts` line 39

```typescript
.insert({
  company_id: companyId,
  delivery_number: deliveryNumber,
  status: "pending",
  scheduled_date: scheduledDate,
  cut_plan_id: bundle.cutPlanId,   // ← cast as `any` to bypass type check
} as any)
```

The `deliveries` table may not have a `cut_plan_id` column in the type definitions. If the column doesn't exist, this insert silently ignores it. If it does exist but the type is wrong, the insert fails silently because errors from `as any` are opaque.

---

### MEDIUM — Edge cases / UX issues

#### 7. `CutterStationView`: `queryClient.invalidateQueries` in `handleCompleteRun` includes wrong key

**File**: `src/components/shopfloor/CutterStationView.tsx` line 324

```typescript
queryClient.invalidateQueries({ queryKey: ["station-data", machine.id, "cutter"] });
```

But the actual query key in `useStationData` is `["station-data", machineId, machineType, companyId, projectId]`. The invalidation uses only 3 elements vs. the 5-element key. TanStack Query uses prefix matching, so this works by accident — but if TanStack changes prefix matching behavior, it would break.

#### 8. Packing slip `Total Length` column is misleading

**File**: `src/components/delivery/DeliveryPackingSlip.tsx` line 135

```typescript
<td className="py-3 text-right tabular-nums">
  {(item.cut_length_mm / 1000).toFixed(2)} m
</td>
```

The column header says "Total Length" but displays `cut_length_mm` (per piece). The actual total length should be `cut_length_mm * total_pieces`. This is confusing on the packing slip — the customer sees per-piece length under a "Total" header.

#### 9. `extract-manifest`: no retry on AI token limit truncation for large barlists

**File**: `supabase/functions/extract-manifest/index.ts` lines 202-215

When JSON is truncated due to token limits, the code tries to repair it by finding the last `},` and appending `]}`. This discards the `summary` and all items after the truncation point. For large barlists (200+ items), this can silently lose 50%+ of the data with no warning to the user.

**Fix**: Add a warning to the response indicating truncation occurred and how many items were recovered vs. expected.

#### 10. `LoadingStation`: no deduplication protection on `handleCreateDelivery`

**File**: `src/pages/LoadingStation.tsx` line 78-84

Double-clicking "Create Delivery" can create duplicate deliveries because the `creating` flag may not update fast enough. The button is disabled by `creating`, but rapid clicks can bypass this.

**Fix**: Add a guard at the start of `handleCreateDelivery`:
```typescript
if (creating) return;
```

#### 11. `PODCaptureDialog`: sets `arrival_time` and `departure_time` to the same timestamp

**File**: `src/components/delivery/PODCaptureDialog.tsx` lines 79-80

```typescript
arrival_time: new Date().toISOString(),
departure_time: new Date().toISOString(),
```

Both are identical, making it impossible to track actual time at the delivery site. Arrival should be recorded when the driver arrives, not when they complete the POD.

---

### Summary of Required Fixes (Priority Order)

| # | Severity | Fix | File |
|---|----------|-----|------|
| 1 | CRITICAL | Update `auto_advance_item_phase` trigger to accept `cut_done` phase for bending completion | DB migration |
| 2 | CRITICAL | Add `company_id` to `rejectExtract` session select and event insert | `manage-extract/index.ts` line 699, 719 |
| 3 | HIGH | Fix `production_tasks.project_id` — use `projectId` not `workOrder.id` | `manage-extract/index.ts` line 590 |
| 4 | HIGH | Calculate `pieces_per_bar` and correct `qty_bars` in approve handler | `manage-extract/index.ts` line 565 |
| 5 | HIGH | Remove `clearance` from completed bundles query — only show `complete` items | `useCompletedBundles.ts` line 37 |
| 6 | MEDIUM | Fix packing slip "Total Length" to show per-piece length or rename column | `DeliveryPackingSlip.tsx` line 135 |
| 7 | MEDIUM | Add truncation warning to `extract-manifest` response | `extract-manifest/index.ts` |
| 8 | MEDIUM | Fix `arrival_time` vs `departure_time` in POD capture | `PODCaptureDialog.tsx` line 79 |
| 9 | LOW | Guard against double-click on Create Delivery | `LoadingStation.tsx` |
| 10 | LOW | Fix `queryClient.invalidateQueries` key to match actual query key structure | `CutterStationView.tsx` line 324 |

### Most Urgent: Bug #1 — Bender items stuck forever

The `auto_advance_item_phase` trigger bug (#1) is the most impactful. With the previous fix removing `phase: "bending"` from the bender handler, items now complete bending while still in `cut_done` phase. The trigger never fires the clearance transition because it requires `phase = 'bending'`. This means:

- All bent items stay in `cut_done` forever
- They remain visible on the bender station after completion
- They never appear in clearance or loading station
- The entire post-bending pipeline is broken

