

# Fix: "Machine already has an active run" — Frontend Guard Missing

## Root Cause
The `handleLockAndStart` function (line 270) only guards against `!currentItem` and `startingRef.current`. It does **not** check whether the machine already has a `current_run_id`. This means:

1. If `completedLocally` is `true` from a prior completion, `machineIsRunning` evaluates to `false` even though `machine.status === "running"` (line 203: `isRunning || (!completedLocally && machine.status === "running")`)
2. The CutEngine shows the "Start" button
3. User clicks Start → backend correctly blocks with 400

The `completedLocally` flag is meant to prevent the UI from snapping back to "running" state after completing a run, but it also masks a genuinely active run on the machine.

## Fix (2 changes in same file)

### 1. Guard `handleLockAndStart` against existing active run
Add a check at the top of `handleLockAndStart`:
```typescript
if (machine.current_run_id && machine.status === "running") {
  toast({ title: "Machine busy", description: "Complete or abort the current run first.", variant: "destructive" });
  startingRef.current = false;
  return;
}
```

### 2. Fix `machineIsRunning` to not be masked by `completedLocally` for different items
The `completedLocally` flag should only suppress the running state for the **item that was just completed**, not for all items. Change line 203:
```typescript
const machineIsRunning = isRunning || machine.status === "running";
```
And update the `completedLocally` mechanism to instead clear itself once the machine actually transitions to idle (which it already does on line 206-210, but it's being checked too early on line 203).

Actually, the simpler and safer fix: reset `completedLocally` when the machine's `current_run_id` changes to a **new** run (not null):

```typescript
// Line 203 — trust machine.status when there's a current_run_id
const machineIsRunning = isRunning || 
  (machine.status === "running" && machine.current_run_id != null);
```

And remove the `!completedLocally` guard, since `completedLocally` resets on line 208 when `machine.status !== "running"`.

## Files Changed
- `src/components/shopfloor/CutterStationView.tsx` — 2 edits (guard + machineIsRunning logic)

