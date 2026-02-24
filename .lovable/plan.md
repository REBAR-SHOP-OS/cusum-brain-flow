

## Hide Capability Tags on Idle Machines

### Problem
The capability badges ("BEND", "MAX 35M", "CUT", "MAX 35M", etc.) are visible on every machine card in the station selector regardless of status. They should only appear when the machine has been started (status is "running").

### Change
**File: `src/components/shopfloor/MachineSelector.tsx`** (lines 124-134)

Add a condition to only render capability badges when `machine.status === "running"`:

```text
// Before (line 125):
{spec && (

// After:
{spec && machine.status === "running" && (
```

Single line change. No other files or logic affected.

