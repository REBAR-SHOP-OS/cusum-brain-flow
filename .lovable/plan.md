
Root issue: this is not a user-specific permission problem anymore. The upload flow in `src/components/office/OrderCalcView.tsx` is too brittle, so some valid Excel files parse to zero rows and show “No rebar items found”. The current parser only:
- reads the first sheet
- inspects only the first 10 rows for headers
- accepts a narrow set of header names
- falls back to fixed column indexes that may not match all exports
- does not reuse the project’s more complete RebarCAD parsing logic

Do I know what the issue is? Yes.

What is actually wrong:
- `OrderCalcView.tsx` has its own simplified `parseRows()` implementation.
- The project already has a more robust canonical parser in `supabase/functions/_shared/rebarCADParser.ts` (`parseRebarCADRows`, `normalizeBarSize`, standard RebarCAD column mapping).
- Because the Office tool uses a weaker duplicate parser, files that differ slightly in sheet order, header wording, or header row position can fail even though they are still valid bar lists.
- This explains why one user/file flow works and another shows the warning: the failure is format-variant sensitivity, not role access.

Implementation plan

1. Replace the local parser in `src/components/office/OrderCalcView.tsx`
- Remove the inline `parseRows()` / duplicated bar-size mapping logic.
- Extract or share a reusable parser module in `src/lib` or `src/utils` based on the canonical RebarCAD parser behavior.
- Use a single source of truth for:
  - bar size normalization
  - header detection
  - standard RebarCAD fallback column layout
  - cut length normalization

2. Make the parser resilient to real-world Excel variations
- Try all workbook sheets, not only `wb.SheetNames[0]`.
- For each sheet:
  - read with `header: 1`
  - inspect more than 10 rows for header detection
  - support broader aliases for key columns (`pcs`, `qty`, `quantity`, `bar size`, `size`, `length`, `cut length`, `total length`, etc.)
- Accept standard RebarCAD exports even when the header row is offset by title rows or metadata rows.
- Keep the “skip empty / zero qty / zero size” guards, but do not silently fail due to narrow assumptions.

3. Return structured parse diagnostics
- Instead of only returning parsed items, return:
  - parsed items
  - matched sheet name
  - detected header row
  - reason when a sheet is skipped
- In `OrderCalcView.tsx`, show a precise toast when all sheets fail, such as:
  - no recognized header row
  - no valid quantity rows
  - no supported bar sizes found
This prevents future “mystery failures” for any file.

4. Preserve current calculation behavior
- Keep existing order-calculator outputs intact:
  - grouping by bar size
  - waste factor
  - stock length options
  - CSV export
  - DB weight-per-meter lookup from `rebar_sizes`
- Only change the ingestion/parsing layer so existing successful files continue working.

5. Add a safe fallback path for compatible but imperfect files
- If canonical header detection fails, attempt standard RebarCAD positional parsing on each sheet before giving up.
- This ensures files with shifted labels or lightly modified exports still load.
- If parsing still yields rows but bar sizes are non-canonical, normalize them before rejection.

Files to change
- `src/components/office/OrderCalcView.tsx`
- New shared parser file, likely:
  - `src/lib/rebarCadParser.ts` or `src/utils/rebarCadParser.ts`

Technical details
- Best approach is not another patch to the current `parseRows()`.
- The root fix is to stop maintaining two different RebarCAD parsers in the project.
- The Office upload should reuse the same parsing rules already established elsewhere in the codebase.
- This will make the feature deterministic and prevent any future file from failing for the same narrow-header reason.

Validation after implementation
- Upload a known working file and confirm no regression
- Upload the previously failing file and confirm rows appear
- Verify parser works when:
  - data is on sheet 2+
  - header starts below row 10
  - headers vary slightly
  - workbook includes intro/title rows before the table
