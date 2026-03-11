

## Fix: Abort button stays red after clicking abort

### Problem
After clicking "ABORT — FIX SETTINGS", the button remains visible (red) because `machineIsRunning` stays `true`. The local `isRunning` is set to `false`, but `machine.status` from the database still reads `"running"` until the next realtime/poll update arrives. Since `machineIsRunning = isRunning || (machine.status === "running" && ...)`, it remains truthy.

### Root Cause
Line 208 in `CutterStationView.tsx`:
```
const machineIsRunning = isRunning || (machine.status === "running" && machine.current_run_id != null);
```
The `completedLocally` flag already exists and is set to `true` on abort (line 388), but it's not used to suppress the stale backend status.

### Fix
**File: `src/components/shopfloor/CutterStationView.tsx`** — Line 208

Change `machineIsRunning` to exclude stale backend status when a local completion/abort has occurred:

```typescript
const machineIsRunning = isRunning || (!completedLocally && machine.status === "running" && machine.current_run_id != null);
```

This single-line change ensures that once an abort (or completion) sets `completedLocally = true`, the UI immediately reflects the idle state. When the DB catches up and `machine.status` changes to something other than `"running"`, the existing `useEffect` on line 211–214 clears `completedLocally`.

### Impact
- No other files affected
- Existing completion flow already sets `completedLocally = true` (line 569), so this also prevents brief "ghost running" state after normal run completion

