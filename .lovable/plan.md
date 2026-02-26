

## Problem

After completing a run (via the slot tracker's "Complete Run"), the same mark/item appears to "repeat" because `machineIsRunning` stays `true` even after local `isRunning` is set to `false`. This happens because:

```typescript
// Line 136
const machineIsRunning = isRunning || machine.status === "running";
```

After `handleCompleteRun`:
1. Local `isRunning` → `false`
2. But `machine.status` in DB still says `"running"` (stale until realtime/invalidation catches up)
3. So `machineIsRunning` remains `true` → CutEngine shows "RUNNING...", slot tracker is empty, foreman re-plans for the same item → looks like the mark is repeating

## Fix — `src/components/shopfloor/CutterStationView.tsx`

Add a `completedLocally` flag that suppresses the stale `machine.status === "running"` check after a run is completed locally:

1. **New state**: `const [completedLocally, setCompletedLocally] = useState(false);`

2. **In `handleCompleteRun`**: Set `setCompletedLocally(true)` alongside `setIsRunning(false)`

3. **Clear flag when DB catches up**:
   ```typescript
   useEffect(() => {
     if (machine.status !== "running") {
       setCompletedLocally(false);
     }
   }, [machine.status]);
   ```

4. **Update machineIsRunning** (line 136):
   ```typescript
   const machineIsRunning = isRunning || (!completedLocally && machine.status === "running");
   ```

This ensures that once a run is completed locally, the UI immediately reflects "idle" state without waiting for the DB to sync, preventing the "repeat" behavior.

