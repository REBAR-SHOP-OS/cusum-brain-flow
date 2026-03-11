

## Fix: Allow Supervisor to Adjust Bars Mid-Run

### Problem
In `CutEngine.tsx`, the up/down buttons for "Bars to Load" have `disabled={... || isRunning}`. This means even when Supervisor mode is active, the buttons are disabled during an active run. The purpose of supervisor mode is to allow overrides, so this `isRunning` guard should be relaxed for supervisors.

### Change in `src/components/shopfloor/CutEngine.tsx`

**Line 229** — Down button disabled condition:
```
// Before:
disabled={bars <= 1 || isRunning}
// After:
disabled={bars <= 1 || (isRunning && !isSupervisor)}
```

**Line 251** — Up button disabled condition:
```
// Before:
disabled={bars >= maxBars || isRunning}
// After:
disabled={bars >= maxBars || (isRunning && !isSupervisor)}
```

This allows supervisors to adjust bars even during an active run, while operators remain locked out as before.

