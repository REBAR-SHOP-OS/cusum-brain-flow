## Root cause found

- The old failed ALA sessions show the backend error:
  - `duplicate key value violates unique constraint "extract_rows_session_row_unique"`
- The latest ALA upload did eventually extract 68 rows, but the UI is stuck at `Loading extracted rows…` while the page already shows duplicate preview data.
- The uploaded `ALA.xls` itself contains pairs of rows for SD02 and SD03, so the 34 duplicate groups are source/data duplicates, not a save failure.
- The current extraction path still has two weak points:
  1. It depends on the AI model to turn an Excel table into rows, then overlays spreadsheet dimensions afterward. This is slow and fragile for RebarCAD `.xls` files.
  2. The row hook can leave `loading=true` during retry polling, so the table can keep showing `Loading extracted rows…` even when rows are already available or after delayed refetches.

## Fix plan

1. **Add deterministic spreadsheet extraction for RebarCAD XLS/XLSX/CSV**
   - In `supabase/functions/extract-manifest/index.ts`, detect the schedule header row (`Item`, `No. Pcs`, `Dwg.No`, `Size`, `Length`, `Mark`, `Type`, `A/B/C...`).
   - Parse rows directly from the spreadsheet by header position.
   - Preserve exact source text for lengths/dimensions, including `0'-4"` format.
   - Skip blank/footer rows.
   - Keep dimension `I` skipped as required by rebar standards.
   - For straight rows, put length in `B` and leave `A` blank/null.
   - Use this deterministic result instead of calling AI for spreadsheet files when the table is recognized.

2. **Keep the existing AI path as fallback only**
   - If a spreadsheet does not match the RebarCAD schedule layout, keep the current AI extraction + overlay behavior.
   - This preserves support for unusual spreadsheets without changing unrelated flows.

3. **Make saving idempotent and clean for retries**
   - Keep the current upsert on `(session_id,row_index)`.
   - Ensure stale/prior rows are cleared before a retry so the same session cannot fail with duplicate-key errors again.
   - Do not delete or alter any approved production/clearance data; this only affects extract rows for the active extraction session.

4. **Fix the stuck `Loading extracted rows…` UI state**
   - In `useExtractRows`, finish loading after the first fetch even if background retry polling continues.
   - If retry polling later finds rows, update rows without re-locking the UI in loading state.
   - Add a guard so switching sessions cannot let an old retry update the wrong session.

5. **Add regression coverage**
   - Add/extend tests to lock in:
     - spreadsheet extraction has a deterministic path and does not require AI for RebarCAD tables;
     - `.upsert(... onConflict: "session_id,row_index")` remains in place;
     - `useExtractRows` does not stay loading forever while retry polling.

## Validation after implementation

- Deploy/test `extract-manifest`.
- Re-run extraction for `ALA.xls` through the backend using the current preview user session.
- Confirm session reaches `status=extracted`, `progress=100`, and row count is 68.
- Confirm the UI no longer stays on `Loading extracted rows…` after rows exist.
- Confirm duplicate preview still shows the 34 source duplicate groups so the operator can choose merge/skip deliberately.