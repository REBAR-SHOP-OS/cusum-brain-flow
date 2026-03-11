

## Root Cause Analysis

There are **two distinct paths** where `completedAtRunStart` is null while the UI shows the running state with "Record Stroke" available:

### Path 1: Normal start flow (handleLockAndStart)
```text
Line 287: setIsRunning(true)           ← triggers re-render, UI shows "Record Stroke"
Line 289: await supabase.from(...)      ← yields to React, user CAN click during this window
Line 295: setCompletedAtRunStart(...)    ← too late, user already got "Initializing..." toast
```
Between the `setIsRunning(true)` and the async DB fetch completing, there's a render where `completedAtRunStart` is still `null`. If the user clicks "Record Stroke" during this ~100-500ms window, they hit the guard at line 403.

### Path 2: Backend says running but restoration didn't match
If `machineIsRunning` is true (from `machine.status === "running"`) but the restoration effect couldn't find the item in the local `items` list (`lockedIndex === -1`), `isRunning` stays false but `machineIsRunning` is still true. CutEngine receives `isRunning={machineIsRunning}` and shows the running UI with stroke buttons, but `completedAtRunStart` was never set.

### Fix: Two changes in `CutterStationView.tsx`

**1. handleLockAndStart (line 287)** — Set sync fallback immediately:
```typescript
setIsRunning(true);
setCompletedAtRunStart(completedPieces); // Sync fallback — async fetch refines below
```
This eliminates the render gap. The async fetch at line 294 will overwrite with the fresh value within ms.

**2. handleRecordStroke (line 403)** — Replace hard block with graceful fallback:
Instead of showing an error toast and returning, fall back to `completedPieces` from the DB:
```typescript
const effectiveRunStart = completedAtRunStart ?? completedPieces;
```
This ensures strokes are never blocked. The worst case is a slightly stale counter that self-corrects on the next realtime update.

### Impact
- Eliminates "Initializing..." toast permanently across all scenarios
- No behavioral change to the production counter accuracy (atomic increments are unaffected)
- Two lines changed in one file

