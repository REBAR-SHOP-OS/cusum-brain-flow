

# Fix: Auto Clock-Out Function Not Deployed + Immediate Reset

## Problem
The `auto-clockout` edge function returns 404 — it was never deployed. This means the 8 AM morning reset cron has been firing but failing silently. Users who clocked in days ago may still appear as "clocked in" if the page hasn't refreshed after manual cleanup.

The DB currently shows **no open shifts** (they may have been manually closed), but the function must be deployed for the daily 8 AM reset to work going forward.

## Plan

### 1. Deploy the `auto-clockout` edge function
Deploy the updated function that supports `mode: "morning"` and `mode: "evening"`.

### 2. Manually trigger the morning reset
Call the function with `{"mode": "morning"}` to ensure any remaining stale state (like `is_active: true` on profiles) is cleaned up.

### 3. Verify all profiles are set to inactive
After the function runs, confirm that `is_active` is false for all profiles (they must clock in manually to become active).

No code changes needed — just deployment and execution of the existing edge function.

