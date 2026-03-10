

# Fix: Station Data Query — Invalid Column

## Root Cause
In `src/hooks/useStationData.ts`, the cutter query uses `.order("created_at", { ascending: true })` but the `cut_plan_items` table has no `created_at` column. This causes a 400 error, which surfaces as "Failed to load station data."

## Fix
**File:** `src/hooks/useStationData.ts`

Change `.order("created_at", { ascending: true })` to `.order("id", { ascending: true })` (or another existing column like `cut_plan_id`). The `id` column is a safe fallback for deterministic ordering.

Single line change, no other files affected.

