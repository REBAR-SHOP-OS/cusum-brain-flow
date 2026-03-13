

# Fix: "Machine Busy" Error — Stale Run Detection

## Root Cause

CUTTER-01 has a run (`23e3756b`) that's been in `running` status for **3+ hours** with zero output. This is an orphaned/stale run — the operator likely navigated away or the browser refreshed without completing it.

The current auto-recovery logic on mount (line 88) only clears runs where `status !== "running"`. A genuinely stale run that's still marked `running` in the DB is treated as active, blocking all new starts.

## Fix

### `src/components/shopfloor/CutterStationView.tsx`

**1. Time-based stale detection on mount** (lines ~87-103):

When a run IS `running` in the DB, add a check: if `started_at` is older than 60 minutes AND `output_qty` is null/0, treat it as stale and auto-clear it — same as the existing non-running cleanup path.

```text
Run is "running" in DB
  ├── started_at > 60 min ago AND output_qty = 0/null → STALE → auto-clear
  └── started_at < 60 min → genuinely active → restore
```

**2. Improve the mount query** (line ~85):

Add `started_at, output_qty` to the `select` so we have the data needed for the time check.

**3. Add stale override in handleLockAndStart** (line ~310):

If the machine's `current_run_id` exists but was started >60 min ago, treat it as stale and auto-clear before starting the new run (similar to the existing `completedLocally` path at line 318).

### Summary

- ~15 lines changed in the mount restoration block
- ~10 lines added in `handleLockAndStart` for stale-run auto-clear
- No backend changes needed — the `complete-run` action already handles cleanup

