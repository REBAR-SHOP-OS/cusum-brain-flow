## Root cause

For `STA.xls` (Rebar-CAD bar list), the deterministic spreadsheet parser in `supabase/functions/extract-manifest/index.ts` (`extractRebarRowsFromWorkbook`) detects the header row at row 17 but fails on two specific columns:

1. **QTY column** — the source header is `No. Pcs`. `normalizeHeader` strips punctuation to `"NO PCS"`, but the alias list for quantity is `["QTY","QUANTITY","NO","NUMBER"]`. `"NO PCS"` is not in that list, so the quantity column index resolves to `-1` and every row gets `quantity = null` → renders as `0` and triggers the "Quantity: all values empty" mapping error.

2. **Grade column** — this workbook has no per-row Grade column. Grade is a **sheet-level metadata cell**: row 13 contains `"Grade :"` in column 15 and `"400/R"` in column 21. The parser only looks for a column named `GRADE` inside the header row, so every row gets `grade = null`.

The mapping panel auto-detect is correct; it just has nothing to map to because the upstream extract rows are empty for those two fields.

## Fix (surgical, additive, single file)

**File:** `supabase/functions/extract-manifest/index.ts`

1. Widen the quantity alias list in `extractRebarRowsFromWorkbook` to cover Rebar-CAD / common bar-list variants:
   - Add `"PCS"`, `"NO PCS"`, `"NO OF PCS"`, `"NO OF PIECES"`, `"PIECES"`, `"COUNT"`, `"NUM"`, `"NUM PCS"`.
   - Keep existing entries (`QTY`, `QUANTITY`, `NO`, `NUMBER`).

2. Add a small `findSheetLevelGrade(rows, bestHeader)` helper that scans the rows **above** the detected data header for a cell whose normalized text is `GRADE`, then picks the first non-empty cell to its right on the same row (or the next row if same row only has the label). Returns a single string like `"400/R"` or `null`.

3. In the per-row loop, if `idx.grade < 0` (no Grade column in the table) **and** the sheet-level grade was detected, stamp `item.grade = sheetGrade` for every row. Per-row grade column behavior is unchanged when present.

No schema changes, no client changes, no edge-function contract changes, no other surfaces touched.

## Verification

- Add a focused unit test under `tests/regression/extract/` that loads `STA.xls` (or a minimal synthetic workbook reproducing the `"No. Pcs"` header + `"Grade :"` metadata layout) through the same parser logic and asserts:
  - All data rows have `quantity > 0`.
  - All data rows have `grade === "400/R"`.
- Run `bunx vitest run tests/regression/extract` after the change.
- Reupload `STA.xls` in the preview and confirm the QTY column shows `8, 8, 26, 20, …` and Grade column is populated; mapping panel auto-confirms without "all values empty".

## Risk

Low. Both changes are additive and only fire when (a) a previously unmatched quantity header is present, or (b) no Grade column exists but a sheet-level Grade metadata cell does. Existing happy paths (`ALA.xls`, `KCG.xlsx`, etc.) keep matching their existing aliases and per-row Grade columns.
