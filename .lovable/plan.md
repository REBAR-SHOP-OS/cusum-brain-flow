

# Fix: Pipeline Stuck After Apply Mapping

## Problem

After "Apply Mapping" succeeds, the session status is set to `"mapping"` in the edge function. The `getStepIndex` function maps `"mapping"` to step 3, but the Validate/Optimize buttons only render at step 4. There is no way to advance past step 3 -- the pipeline is stuck.

## Root Cause

The edge function (`manage-extract/index.ts` line 393) sets `status: "mapping"` after applying mappings. The UI needs the session to reach step index 4 to show the Validate button, but no status value currently maps to step 4 except `"validated"` -- creating a dead end.

## Fix

Two changes:

1. **Edge function** (`supabase/functions/manage-extract/index.ts` line 393): Change the post-mapping status from `"mapping"` to `"mapped"`.

2. **Client step logic** (`src/components/office/AIExtractView.tsx`, `getStepIndex` function): Add a case for `"mapped"` status that returns step index 4 (the validate/optimize step). This puts the user at the correct position to click Validate or Optimize.

Both changes are single-line edits.

