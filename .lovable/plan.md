## Problem

`Detailed List` writes to `cut_plan_items` (the production-side table).
`Tags & Export` (and `/print-tags`) reads from `extract_rows` (the estimation-side table) via `useExtractRows`.

Once a project enters workstation (= a cut plan exists), the two tables diverge: editing qty / length / dims / mark in Detailed List updates `cut_plan_items` only, so Tags keeps showing the original extract values. That is the bug in the screenshots: `Mark A1001, Qty 12, Length 53"` is the pre-edit value sourced from `extract_rows`.

There is no FK between `cut_plan_items` and `extract_rows`. They are matched implicitly by:
`cut_plan.barlist_id → barlists.extract_session_id` + `mark_number = extract_rows.mark` + `bar_code = extract_rows.bar_size_mapped / bar_size`.

## Surgical fix — additive only

Add a DB trigger that mirrors edits from `cut_plan_items` back to the matching `extract_rows` row in the same session. This catches every edit path (Detailed List today, anything else later) without touching frontend hooks.

### 1. Migration — `AFTER UPDATE` trigger on `cut_plan_items`

`public.mirror_cut_plan_item_to_extract_row()` runs only when one of the mirrored columns actually changes (`mark_number`, `total_pieces`, `cut_length_mm`, `bend_dimensions`, `asa_shape_code`, `bar_code`, `drawing_ref`). It:

- Resolves `session_id` via `cut_plans → barlists.extract_session_id`. Exits if null.
- Finds matching row in `extract_rows` by `session_id` + `mark = OLD.mark_number` (uses OLD so a mark rename still matches its origin row) + `coalesce(bar_size_mapped, bar_size) = OLD.bar_code`.
- Updates that extract row with the new values:
  - `mark`, `quantity`, `total_length_mm`, `bar_size_mapped`, `shape_code_mapped`, `dwg`
  - `dim_a..dim_r` from the new `bend_dimensions` jsonb (keys `A..R`, skip `I`/`L`/`M`/`N`/`P`/`Q`, follow existing `DIM_COLS`)
  - Clears stale source-of-truth text: `source_total_length_text = NULL`, `source_dims_json = NULL` (so the Tags renderer recomputes from numeric values and shows the edited length/dims).
- No-op (no error) if no extract row matches — keeps edits succeeding for purely production-side items.
- `SECURITY DEFINER` + `SET search_path = public` so the trigger can write across tenants’ rows while respecting `company_id` (mirrors only inside the same session, which is already tenant-scoped).
- Trigger registered as `AFTER UPDATE ... FOR EACH ROW WHEN (...)`.

### 2. Audit event

Insert one row into `activity_events` per mirror with `event_type = 'extract_row_mirrored_from_cut_plan'`, payload `{cut_plan_item_id, extract_row_id, session_id, fields_changed[]}` so we can trace any divergence.

### 3. Regression test

New `tests/regression/workflow-gate/DetailedListMirrorsToTags.test.ts`:
- Seed an extract_session + extract_row, a barlist linking them, a cut_plan, and one cut_plan_item with matching `mark_number` + `bar_code`.
- Update qty / length / dims / mark on the cut_plan_item.
- Assert the linked extract_row reflects the new values and that `source_total_length_text` / `source_dims_json` are cleared.
- Negative case: cut_plan_item with no matching extract_row → update still succeeds, no error.

## Out of scope

- No changes to `TagsExportView`, `useExtractRows`, `PrintTags`, or the Detailed List frontend.
- No new tables, no schema changes on `extract_rows` / `cut_plan_items` beyond the trigger.
- Weight column in `extract_rows` is left alone — Tags renderer already recomputes weight from mass-table at display time.
- No backfill for previously-edited cut_plan_items (additive only; future edits will sync going forward). If you want a one-time backfill, say so and I’ll add it as a separate step.

## Files

- `supabase/migrations/<ts>_mirror-cut-plan-edits-to-extract-rows.sql` — new
- `tests/regression/workflow-gate/DetailedListMirrorsToTags.test.ts` — new
