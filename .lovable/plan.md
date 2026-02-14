

# Fix Stale "No QuickBooks ID" Warning Suggestions

## Problem

The old suggestions (created before the code fix) are still sitting in the database with `severity: warning` and the old title format ("X has no QuickBooks ID"). The updated generate-suggestions code now produces `severity: info` with better titles, but:

1. The dedup logic sees the old records and skips creating new ones
2. Old records are never cleaned up or updated
3. So the dashboard keeps showing the stale warnings

## Solution

Two changes:

### 1. Clean up stale `missing_qb` suggestions before regenerating

At the start of the `generate-suggestions` function (after auth), delete all existing `missing_qb` suggestions so they get recreated fresh with the correct severity and titles.

### 2. Immediate data fix

Delete the 9 stale suggestion rows right now so the dashboard clears immediately, without waiting for a regeneration cycle.

## Technical Details

### File: `supabase/functions/generate-suggestions/index.ts`

Add a cleanup step after line 59 (after loading existing dedup sets):

- Delete all suggestions where `category = 'missing_qb'` and `status IN ('open', 'new')` -- this ensures they get recreated fresh each run with the current logic
- Also delete corresponding `human_tasks` with `category = 'missing_qb'` and `status IN ('open', 'snoozed')`
- Remove `missing_qb` entries from the `existingSuggestions` set so the dedup check doesn't block new inserts

### Database: One-time cleanup

Run a delete to remove the 9 stale suggestion rows immediately:
- `DELETE FROM suggestions WHERE category = 'missing_qb' AND status IN ('open', 'new')`

This way, the next time suggestions regenerate, the new code creates them correctly as `info` severity with proper titles, and duplicates/variants are handled as designed.
