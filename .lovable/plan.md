

## Fix: Root-cause elimination of "Machine busy" and "Initializing..." errors

### Problem 1: "Machine busy" after abort/complete
**Root cause**: `handleLockAndStart` (line 277) checks `machine.current_run_id && machine.status === "running"` — but after a local abort/complete, the DB still reports `"running"` briefly. The `completedLocally` flag was added to fix `machineIsRunning` for UI display, but the start guard doesn't use it.

**Fix**: Add `!completedLocally` to the guard at line 277.

### Problem 2: "Initializing..." after page refresh
**Root cause**: During state restoration (line 82-97), `isRunning` is set to `true` synchronously, but `completedAtRunStart` is set asynchronously via `.then()`. During the render gap, the "Record Stroke" button is visible but clicking it hits the `completedAtRunStart === null` guard and shows the toast.

**Fix**: Set `completedAtRunStart = 0` synchronously as an immediate fallback during restoration (line 82), then let the async fetch update it to the real value. This eliminates the render gap entirely. The worst case is a briefly inaccurate counter that self-corrects within milliseconds.

### Changes

**File: `src/components/shopfloor/CutterStationView.tsx`**

1. **Line 77-83** — Add synchronous fallback for `completedAtRunStart` during restore:
```typescript
if (lockedIndex >= 0) {
  setCurrentIndex(lockedIndex);
  setTrackedItemId(machine.active_job_id!);
  setIsRunning(true);
  setActiveRunId(machine.current_run_id);
  setCompletedAtRunStart(0); // Immediate fallback — async fetch refines below
  // Fetch fresh completed count for snapshot
  supabase
    .from("cut_plan_items")
    // ...
```

2. **Line 277** — Respect `completedLocally` in the "Machine busy" guard:
```typescript
if (!completedLocally && machine.current_run_id && machine.status === "running") {
  toast({ ... "Machine busy" ... });
  return;
}
```

Both fixes are in the same file, 2 lines changed total. No other files affected.

