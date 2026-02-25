

## Full Pipeline Audit: Extractor → Delivery — All Problems Found

I traced the entire pipeline (extract → cut plan → cutter station → bender station → clearance → loading → delivery) and cross-referenced with edge function logs, database triggers, and UI code. Here are all the problems identified, ranked by severity.

---

### CRITICAL — Actively breaking in production

#### 1. `manage-machine`: activity_events missing `company_id` (every run start/complete fails to log)

**Evidence**: Every single edge function log shows:
```
null value in column "company_id" of relation "activity_events" violates not-null constraint
```

**Root cause**: Line 547 in `manage-machine/index.ts`:
```typescript
.insert(events.map((e: any) => ({ ...e, source: "system" })));
```
It does NOT add `company_id`. The machine object has `machine.company_id` available, but it's never injected into the events array.

Compare to `manage-inventory/index.ts` line 178 which correctly does:
```typescript
.insert(events.map((e: any) => ({ ...e, source: "system", company_id: companyId })));
```

**Impact**: Zero activity audit trail for ALL machine operations. Every start-run, complete-run, pause-run, operator-assign, and capability-violation event silently fails. This means production analytics, shift reports, and activity feeds are empty.

**Fix**: Add `company_id: machine.company_id` to the events insert at line 547.

---

#### 2. `manage-machine`: capability violation events also miss `company_id`

Lines 206-209 and 244-249 insert early-return events for capability violations with the same missing `company_id`:
```typescript
.insert(events.map((e: any) => ({ ...e, source: "system" })));
```

And line 381 in `start-queued-run`:
```typescript
await supabaseService.from("activity_events").insert(events.map((e: any) => ({ ...e, source: "system" })));
```

Same fix needed in all 3 locations.

---

#### 3. Bender `handleDone` still sets `phase: "bending"` — can trigger `block_production_without_approval`

**File**: `BenderStationView.tsx` line 107:
```typescript
.update({ bend_completed_pieces: newCount, phase: "bending" } as any)
```

If the item's current phase is `cut_done` and the order has `shop_drawing_status: 'draft'`, this `cut_done → bending` transition goes through `block_production_without_approval`. The trigger currently only checks `NEW.phase = 'cutting'`, so bending is NOT blocked — BUT the explicit `phase: "bending"` set is still unnecessary and can conflict with `auto_advance_item_phase` when `bend_completed_pieces >= total_pieces`.

When the bender completes (bend_completed_pieces = total_pieces), the `auto_advance_item_phase` trigger should advance to `clearance`. But the manual `phase: "bending"` fights with the trigger. The trigger fires BEFORE UPDATE and may set phase to `clearance`, then this explicit `phase: "bending"` overwrites it.

**Fix**: Remove `phase: "bending"` from the bender update — let the trigger handle phase transitions (same pattern as the cutter fix already applied).

---

### HIGH — Data integrity / silent failures

#### 4. `CutterStationView`: `handleRecordStroke` uses fire-and-forget without error handling

Line 227-231:
```typescript
supabase
  .from("cut_plan_items")
  .update({ completed_pieces: newCompleted } as any)
  .eq("id", currentItem.id)
  .then(); // fire-and-forget, don't block UI
```

If this fails (e.g., RLS policy, network blip), the operator sees progress locally via `slotTracker` but the DB never updates. When `handleCompleteRun` later calculates `newCompleted` from `completedAtRunStart + totalOutput`, the final DB write succeeds but intermediate progress is lost. If the browser crashes between strokes, all progress since `completedAtRunStart` is lost.

**Fix**: At minimum, add `.then(({ error }) => { if (error) console.error(...) })` and consider a retry queue.

#### 5. `CutterStationView`: `currentIndex` not clamped on item change

Same issue as bender — already fixed in `BenderStationView` but NOT in `CutterStationView`. If a completed item is removed from the items array (phase moves to `cut_done`/`complete`), `currentIndex` can point beyond the array.

The `useEffect` fix was planned but I don't see it in the current `CutterStationView.tsx`. The cutter relies on manual navigation and auto-advance on complete, but if realtime removes the item mid-run, the view can break.

**Fix**: Add the same `useEffect` clamping pattern from `BenderStationView`.

#### 6. Delivery creation: `useDeliveryActions` uses `as any` everywhere to bypass type safety

Lines like:
```typescript
.insert({ ... } as any)
.from("packing_slips" as any)
```

This hides any schema mismatches. If the `deliveries` or `packing_slips` table schema changes, errors will only surface at runtime.

---

### MEDIUM — Functional gaps / edge cases

#### 7. Extract → Cut Plan pipeline: no automatic flow

The extraction pipeline (`extractService.ts`) creates `extract_sessions` and `extract_rows`, but there's no code path that automatically converts approved extract rows into `cut_plan_items`. The `approveExtract` function calls `manage-extract` with `action: "approve"`, but the edge function's approve handler likely only updates the session status. Items must be manually created.

#### 8. Bender station: items query includes `phase.eq.bending` but completed items stay visible

When `bend_completed_pieces >= total_pieces`, the `auto_advance_item_phase` trigger should change phase to `clearance`, filtering the item out. BUT if the trigger doesn't fire on `bend_completed_pieces` updates (it only fires on `phase` or `completed_pieces` changes), the bender item stays visible with phase `bending` even after completion.

Check: The trigger `auto_advance_item_phase` may only watch `completed_pieces`, not `bend_completed_pieces`. This would mean bend items never auto-advance unless phase is explicitly changed.

#### 9. `StationView`: `selectedItemId` auto-clear only works when `filteredItems.length > 0`

Line 119:
```typescript
if (selectedItemId && filteredItems.length > 0 && !filteredItems.some(...))
```

If ALL items complete and `filteredItems` becomes empty (`length === 0`), the condition short-circuits — `selectedItemId` is NOT cleared, and the user is stuck viewing `BenderStationView` with no items and no way back (except the Back button).

**Fix**: Remove the `filteredItems.length > 0` guard, or add an additional branch for empty arrays.

#### 10. `StationView` realtime subscription: channel name collisions

Line 122: The channel name `station-${machineId}` doesn't include `machineType` or `projectId`. If the same machine is opened in multiple tabs with different filters, they share the same channel — harmless but the invalidation query key includes `projectId`, so a filter change would miss invalidation from the shared channel.

---

### LOW — Warnings / code quality

#### 11. Console warnings: `StationHeader` and `CutEngine` can't receive refs

Both components are function components without `forwardRef`, but `CutterStationView` passes refs to them. This generates React warnings on every render.

#### 12. `manage-machine`: no `company_id` validation for capability violation early returns

Lines 206-209 and 381 — events are inserted without try/catch wrapping, which could crash the function if the insert throws (though in practice the missing `company_id` causes a softer "Failed to log" error).

#### 13. `useDeliveryActions`: site_address lookup silently catches all errors

The `try/catch` block around project lookup (line ~56) catches everything silently. If the project lookup fails, the delivery and packing slip are created without an address — which means the driver has no delivery location.

---

### Summary of Required Fixes (Priority Order)

| # | Severity | Fix | File |
|---|----------|-----|------|
| 1 | CRITICAL | Add `company_id: machine.company_id` to ALL event inserts | `manage-machine/index.ts` (lines 207, 247, 381, 547) |
| 2 | CRITICAL | Remove `phase: "bending"` from bender DONE handler | `BenderStationView.tsx` line 107 |
| 3 | HIGH | Add `currentIndex` clamping useEffect | `CutterStationView.tsx` |
| 4 | HIGH | Add error callback to fire-and-forget stroke persistence | `CutterStationView.tsx` line 227 |
| 5 | MEDIUM | Fix `selectedItemId` clear when `filteredItems` is empty | `StationView.tsx` line 119 |
| 6 | LOW | Add `forwardRef` to `StationHeader` and `CutEngine` | Both components |

