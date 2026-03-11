

## Fix: "Initializing..." stuck permanently after page refresh

### Root Cause

In `CutterStationView.tsx` line 66-101, the restoration effect has a critical race condition:

```text
useEffect deps: [machine.cut_session_status, machine.active_job_id, machine.machine_lock, restoredFromBackend]
                 ↑ arrives first                                                          
                 
Guard: items.length > 0  ← items haven't loaded yet, so restoration is SKIPPED
                          
BUT: setRestoredFromBackend(true) runs UNCONDITIONALLY at line 100
     → When items finally load, the effect won't re-run (restoredFromBackend is already true)
     → completedAtRunStart stays null forever
     → Every "Record Stroke" click shows "Initializing..." toast
```

### Fix

**File: `src/components/shopfloor/CutterStationView.tsx`**

Two changes:

1. **Add `items.length` to the dependency array** so the effect re-runs when items load
2. **Only set `restoredFromBackend = true` inside the success path or when machine is genuinely idle** (not when items simply haven't loaded yet)

```typescript
useEffect(() => {
  if (restoredFromBackend) return;
  
  // Don't finalize restoration until items have loaded
  if (items.length === 0) return;
  
  if (
    machine.cut_session_status === "running" &&
    machine.active_job_id &&
    machine.machine_lock
  ) {
    const lockedIndex = items.findIndex(i => i.id === machine.active_job_id);
    if (lockedIndex >= 0) {
      // ... restore state (unchanged)
    }
  }
  setRestoredFromBackend(true);
}, [machine.cut_session_status, machine.active_job_id, machine.machine_lock, restoredFromBackend, items.length]);
```

Key change: `if (items.length === 0) return;` is placed BEFORE the `setRestoredFromBackend(true)` call, ensuring the effect waits for items to load before finalizing. Once items load, the effect re-runs (thanks to `items.length` in deps), performs restoration if needed, then sets the flag.

### Impact
- Single file change, 2 lines modified
- Fixes the permanent "Initializing..." state on page refresh
- No effect on normal (non-refresh) flow since items are already loaded when starting a run

