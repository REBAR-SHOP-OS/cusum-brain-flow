

# Fix: Queue Open Shows "ABORT" + Error on Lock & Start

## Problem
When opening a queue item from pool, the machine often has a stale run from a previous session. This triggers:
1. Restoration logic (line 68-82) sets `isRunning=true` → shows "ABORT — FIX SETTINGS" immediately instead of "LOCK & START"
2. After aborting, user tries LOCK & START → gets "Machine already has an active run" error because the stale run is < 30 minutes old, so the backend's auto-recovery (30-min threshold) doesn't trigger

## Root Cause
The 30-minute stale threshold in `manage-machine` is too conservative. A run that was just "abort-completed" may not be fully cleared by the time the next start request arrives, or the machine's realtime state hasn't refreshed.

## Fix (2 changes)

### 1. `src/components/shopfloor/CutterStationView.tsx` — Smarter restoration
In the restoration effect (line 66-103), before blindly setting `isRunning=true`, verify the run is actually valid by checking if `machine.current_run_id` has an active `machine_runs` row with status `running`. If the run is stale/completed/canceled, auto-clear it client-side instead of forcing the user to manually abort.

**New logic:**
```
On mount restoration:
  - If machine has current_run_id + status=running:
    → Fetch the actual machine_run row
    → If run status is NOT 'running' (completed/canceled/paused) → call complete-run to reset, don't set isRunning
    → If run IS running → restore as before (set isRunning=true)
```

### 2. `src/components/shopfloor/CutterStationView.tsx` — Force-clear before start
In `handleLockAndStart` (line 276), if the machine still has a `current_run_id` but we know we just aborted (via `completedLocally`), explicitly send a `complete-run` with cleanup notes before starting the new run, ensuring the backend is clean.

**New logic in handleLockAndStart:**
```
Before calling start-run:
  - If machine.current_run_id exists AND completedLocally is true:
    → await manageMachine({ action: "complete-run", machineId, outputQty: 0, scrapQty: 0, notes: "Pre-start cleanup" })
    → Continue with start-run
```

## Files Changed
- `src/components/shopfloor/CutterStationView.tsx` — smarter restoration + pre-start cleanup

