

# Root Cause: Straight Items Skip Clearance — Go Directly to Complete

## Findings

The `auto_advance_item_phase` database trigger has this flow:

```text
Cutting done + bend_type = 'bend'     → cut_done → (bending) → clearance → complete
Cutting done + bend_type = 'straight' → complete  (SKIPS clearance entirely)
```

**This means straight rebar items never appear in the Clearance station.** They jump from cutting directly to `complete`, bypassing QC/photo verification.

### Data confirms it:
- 160 items in `clearance` phase — ALL are bend type
- 127 items in `complete` — ALL straight (never went through clearance)
- 11 items stuck in `cut_done` — bend items where `bend_completed_pieces = 0` (bending hasn't started)

### The user's "TDC CUSTOMS" projects likely have straight items that finished cutting and went straight to `complete`, so they never show up in the Clearance view.

## Fix

### Database Migration — Update `auto_advance_item_phase` trigger

Change the straight-bar path so it also goes through clearance:

```text
BEFORE:  straight + cutting done → complete
AFTER:   straight + cutting done → clearance
```

Updated logic:
```sql
-- Cutting complete → advance
IF NEW.completed_pieces >= NEW.total_pieces 
   AND NEW.total_pieces > 0
   AND NEW.phase IN ('queued', 'cutting') THEN
  IF NEW.bend_type = 'bend' THEN
    NEW.phase := 'cut_done';
  ELSE
    NEW.phase := 'clearance';  -- was 'complete', now routes through clearance
  END IF;
END IF;
```

### Also fix the 11 stuck `cut_done` items

These 11 bend items have `completed_pieces >= total_pieces` but `bend_completed_pieces = 0`. They are cut-complete but bending hasn't started. This is correct behavior (they're waiting for bending), not a bug. No action needed for these.

### Optional: Backfill existing straight items that already skipped clearance

Run a one-time update to move straight items that are already `complete` but were never cleared back to `clearance` — **only if the user wants retroactive QC**. This is optional and should be confirmed with the user.

## Summary

| Change | File |
|--------|------|
| Update `auto_advance_item_phase` trigger | Database migration (SQL) |

Single trigger change. No frontend changes needed — the Clearance UI already handles all items in the `clearance` phase regardless of bend type.

