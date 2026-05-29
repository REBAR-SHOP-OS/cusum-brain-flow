# Detailed List edit: no unit conversion

## Problem

In `src/components/office/DetailedListView.tsx`, the edit row currently runs every value through `mmToEditUnit` on open and `displayModeToMm` on save. But the underlying columns are already in the **source unit** for imperial rows — `cut_length_mm` is famously misnamed (see `src/lib/cutLengthDisplay.ts` comment: *"for imperial rows it stores the raw numeric value in the source unit, e.g. 8' is stored as 96, not 2438"*). Same goes for `bend_dimensions` keys.

That's why an imperial 6" dim shows up in the edit input as `0.24` (= 6 / 25.4) — the code treats 6 as mm and divides by 25.4.

User rule: **no unit conversion on edit**. The number the user types is the number that gets saved.

## Surgical fix (frontend only)

File: `src/components/office/DetailedListView.tsx`

1. **Remove conversion on open** (`startEdit`, lines ~62–86):
   - Delete the `mmToEditUnit` helper.
   - Initialize `editValues.cut_length_mm` and every key in `editValues.bend_dimensions` with the raw numeric value straight from `item` (no division).

2. **Remove conversion on save** (`saveEdit`, lines ~94–104):
   - Stop calling `displayModeToMm` on `cut_length_mm` and on each dim.
   - Pass the numbers in `updatePayload` unchanged.
   - Keep the rest of the save flow (RLS-empty-result guard, toast, refetch) intact.

3. **Inputs accept decimals** (lines 396 + 405):
   - Change `parseInt(e.target.value) || 0` → `parseFloat(e.target.value) || 0` and `parseInt(...) || undefined` → `parseFloat(...) || undefined`, and add `step="any"` to both `<Input type="number">`s, so imperial fractional values like `6.5` or `0.75` round-trip without truncation.

4. **Drop now-unused imports**: `sessionUnitToDisplay`, `displayModeToMm`, `LengthDisplayMode`, and the `editUnit` const. Keep `useUnitSystem`, `formatLength`, `barSizeLabel`, `UnitSystem` — they're still used by the non-edit display.

Nothing else changes. The DB columns keep their existing (misnamed) convention; the existing `mirror_cut_plan_item_to_extract_row` trigger copies the value through as-is, so Tags & Export will continue to mirror correctly.

## Out of scope

- No DB migration. No rename of `cut_length_mm`.
- No change to the read-only display formatter, to `TagsExportView`, `PrintTags`, or the mirror trigger.
- No change to AI Extract / Production Queue edit paths (this report is only about the Detailed List edit fields in the screenshot).
- No backfill for previously-edited rows.

## Regression test

Add `tests/regression/workflow-gate/DetailedListNoUnitConversion.test.ts`:

- Static check that `DetailedListView.tsx` no longer imports `displayModeToMm` and no longer references `mmToEditUnit`, so the no-conversion contract can't silently regress.
- Static check that both numeric inputs use `parseFloat` and `step="any"`.

## Files

- `src/components/office/DetailedListView.tsx` — edited
- `tests/regression/workflow-gate/DetailedListNoUnitConversion.test.ts` — new
