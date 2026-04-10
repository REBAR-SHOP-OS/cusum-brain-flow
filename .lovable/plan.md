

# Add Unlock Button When Machine Is Locked

## Problem
When a cutter (or bender) machine is locked, the station view shows a "LOCKED" status bar but provides **no way to unlock** unless there's a mismatched job. The user has to leave the station and find another way to clear the lock. The bender station has no lock management UI at all.

## Changes

### 1. CutterStationView — Add unlock button to lock status bar
**File**: `src/components/shopfloor/CutterStationView.tsx` (lines 747-759)

The existing "MACHINE LOCK STATUS BAR" (shown when `machine.machine_lock && !machineHasMismatchedRun`) currently shows only a label. Add a "Clear Lock" button to this bar — visible when no run is actively in progress (`!isRunning`). This lets the operator or supervisor unlock the machine without needing to navigate away.

The button will call `manageMachine({ action: "complete-run", ... })` to clear the lock, same pattern as the mismatched run banner already uses (line 725-739).

### 2. BenderStationView — Add lock detection and unlock banner
**File**: `src/components/shopfloor/BenderStationView.tsx`

Add the same lock detection logic as the cutter:
- If `machine.machine_lock` is true and `machine.cut_session_status === "running"`, show a lock status bar with a "Clear Lock" button
- Import `manageMachine` from the service
- Call `manageMachine({ action: "complete-run", machineId, outputQty: 0, scrapQty: 0 })` on click

### Scope
- 2 files modified: `CutterStationView.tsx`, `BenderStationView.tsx`
- No database or edge function changes
