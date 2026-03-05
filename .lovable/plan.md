

# Fix: Inflated `completed_pieces` — Data Correction + Supervisor Reset

## Problem
The code fix we just deployed (removing the duplicate `increment_completed_pieces` call on run completion) prevents **future** double-counting. However, **existing data is already inflated** from previous double-counted runs. For item A2002, the database shows `completed_pieces = 120` (fully capped at `total_pieces`), but the user has only actually completed 39 pieces. This is why the UI showed 54 before the stroke and 75 after — the `completedAtRunStart` snapshot captured an inflated DB value.

## Root Cause
Every past completed run added pieces **twice**: once per-stroke and once on completion. With 3 runs of 18 pieces each:
- Actual: 3 × 18 = 54 pieces (user says 39, so likely 2 full + 1 partial)
- Recorded: 3 × 18 (strokes) + 3 × 18 (completion) = 108, capped at 120 by LEAST()

## Fix (2 parts)

### Part 1: One-time data correction (Database Migration)
Reset `completed_pieces` for the affected item(s) to actual values. Since we can't derive the true count from machine_runs (they don't link to specific items), we'll:
1. Reset A2002 (`608a130b-3b61-4a7a-a66f-33ce213924d2`) to `39` (user-reported actual)
2. Check other items with inflated counts and reset proportionally (roughly halve any non-zero counts, since each piece was counted ~2x)

SQL migration:
```sql
-- Fix A2002 specifically (user-confirmed actual = 39)
UPDATE cut_plan_items SET completed_pieces = 39 WHERE id = '608a130b-3b61-4a7a-a66f-33ce213924d2';

-- Fix other inflated items: halve the count (since each was ~2x counted)
UPDATE cut_plan_items 
SET completed_pieces = CEIL(completed_pieces::numeric / 2)
WHERE completed_pieces > 0 
  AND id != '608a130b-3b61-4a7a-a66f-33ce213924d2';
```

### Part 2: Supervisor "Reset Counter" button
Add a UI control so supervisors can manually correct `completed_pieces` for any item — preventing the need for future database interventions.

**In `CutterStationView.tsx`**:
- Add a small "Reset" or "Correct Count" button next to the "PIECES DONE" card, visible only when the user has write/supervisor access
- On click, show a dialog with an input field pre-filled with the current count
- On confirm, directly update `completed_pieces` on `cut_plan_items` via Supabase
- Invalidate queries to refresh UI

This ensures:
- Existing inflated data is corrected immediately
- Future inflation is prevented by the code fix already deployed
- Supervisors can self-service correct any remaining discrepancies

