

# Add `loading` Phase Between Clearance and Complete

## Current Flow
```text
clearance → (QC cleared) → complete
LoadingStation queries phase="complete"
PickupStation queries phase="complete"
```

## Target Flow
```text
clearance → (QC cleared) → loading → (loaded on truck) → complete
LoadingStation queries phase="loading" (instead of "complete")
```

## Changes

### 1. Database Migration — No trigger change needed
The `auto_advance_item_phase` trigger doesn't touch the clearance→complete transition — that's done manually in `ClearanceCard.tsx`. No trigger update required.

### 2. `src/components/clearance/ClearanceCard.tsx` (line 251)
Change the phase set on clearance approval:
```
BEFORE: .update({ phase: "complete" })
AFTER:  .update({ phase: "loading" })
```

### 3. `src/pages/LoadingStation.tsx` (line 52)
Change the query filter to fetch items in the new `loading` phase:
```
BEFORE: .eq("phase", "complete")
AFTER:  .eq("phase", "loading")
```

### 4. `src/hooks/useCompletedBundles.ts` (line 39)
Same change — fetch `loading` phase items instead of `complete`:
```
BEFORE: .eq("phase", "complete")
AFTER:  .eq("phase", "loading")
```

### 5. `src/components/office/PackingSlipsView.tsx` (line 80)
Same change:
```
BEFORE: .eq("phase", "complete")
AFTER:  .eq("phase", "loading")
```

### 6. `src/pages/PoolView.tsx`
- Add `"loading"` to the `PoolPhase` type and `PHASES` array (between clearance and complete)
- Add `loading` entry to `PHASE_CONFIG`:
  ```
  loading: { label: "LOADING", shortLabel: "LOADING", icon: Package, color: "text-cyan-400", bg: "bg-cyan-500/10", actionLabel: "Load Truck", actionRoute: "/shopfloor/loading", actionColor: "bg-cyan-500 ..." }
  ```
- Update `complete` config label to just "COMPLETE" (no longer "COMPLETE → LOADING")

### 7. `src/components/dashboards/ProductionControl.tsx` (line 9)
Add `"loading"` to PHASES array:
```
["queued", "cutting", "cut_done", "bending", "clearance", "loading", "complete"]
```

### 8. `src/components/dashboards/ShopControl.tsx` (line 10)
Add `"loading"` to TASK_PHASES.

### 9. `src/components/shopfloor/MaterialFlowDiagram.tsx`
Add `loading` phase node between clearance and complete in the flow visualization.

### 10. LoadingStation — mark items complete after loading
Currently LoadingStation doesn't transition items to a next phase (it's the last step now). Need to add a "Confirm Loaded" action that sets `phase: "complete"` when the loading checklist is done. This ensures items only reach `complete` after being loaded.

### 11. Backfill existing `complete` items (optional)
Items currently in `complete` that haven't been loaded could be moved to `loading`. This should be confirmed with the user.

## Summary
- 1 new phase value: `loading`
- ~8 files updated (mostly single-line filter changes)
- No database schema migration needed (phase is a text column)
- ClearanceCard sends items to `loading` instead of `complete`
- LoadingStation reads from `loading` and transitions to `complete` when done

