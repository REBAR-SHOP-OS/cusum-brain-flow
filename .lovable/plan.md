

# Fix: "Invalid packing_slip status: pending"

## Root Cause
A database validation trigger on `packing_slips` only allows statuses: `draft`, `delivered`, `archived`. The Loading Station code inserts with `status: "pending"`, which is rejected.

## Fix
**File: `src/pages/LoadingStation.tsx`** — Change the packing slip insert status from `"pending"` to `"draft"` (line 113).

Single-line change, no database migration needed.

