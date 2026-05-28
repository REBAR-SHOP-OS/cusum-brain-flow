## Outcome
Fix AI Extract for PDF barlists so values stay in the correct columns (Length, A, B, C, D, E, F, G, H, J, K, O, R) instead of being shifted/misread from the PDF table layout.

## Root cause
The PDF path in `extract-manifest` sends the PDF directly to the AI model as a visual document. Unlike spreadsheets, PDFs do not currently get a deterministic table/column overlay. That means the model guesses table reading order from the rendered PDF, and in dense RebarCAD schedules it can concatenate or shift cells across columns (exactly what is visible in the screenshot).

Spreadsheets already have a safer path: header-based deterministic dimension overlay. PDFs do not.

## Plan
1. Add a deterministic PDF text/table extraction path before the AI call.
   - Use `pdfjs-dist` in the `extract-manifest` edge function.
   - Read each PDF page text item with X/Y coordinates.
   - Group text items into visual rows by Y position.
   - Sort each row left-to-right by X position.
   - Preserve column gaps so headers and cells remain aligned.

2. Add a RebarCAD-specific parser for structured PDF text.
   - Detect the header row containing `DWG`, `#`, `GRADE`, `MARK`, `QTY`, `SIZE`, `TYPE`, `LENGTH`, `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `J`, `K`, `O`, `R`.
   - Map values by header label, not by guessed position.
   - Explicitly skip `I` so later columns never shift.
   - Keep exact source strings in `source_total_length_text` / `source_dims_json` for lossless ft-in display.

3. Wire the PDF parser as the preferred path.
   - For PDFs: try deterministic extraction first.
   - If it produces valid rows, save those rows directly and only use AI for summary/context fallback.
   - If the PDF has no extractable text or parsing confidence is too low, fall back to the existing AI vision flow.

4. Keep existing spreadsheet and image behavior unchanged.
   - Spreadsheet deterministic overlay remains as-is.
   - Image files still use the AI vision path.
   - No database schema changes needed.

5. Add regression coverage.
   - Add a regression test for PDF-style row text where `E/F/G` are empty but later rows contain straight-bar Length/A/B values.
   - Assert that values stay under their exact headers and do not shift into neighboring dimensions.
   - Add a second test for the `I` skip rule: `H`, `J`, `K` must remain correctly mapped.

6. Validate with real signals.
   - Run the targeted regression test.
   - Re-check the touched extraction code.
   - If backend test invocation is available, run `extract-manifest` against a PDF sample or a simulated PDF text fixture to confirm saved `extract_rows` fields are correctly mapped.

## Files expected to change
- `supabase/functions/extract-manifest/index.ts`
- `tests/regression/units` or `tests/regression/extract` new regression test file

## Risk control
- The change is additive and narrow: deterministic PDF parsing only activates when it can confidently parse a schedule table.
- Existing AI fallback remains in place for scanned/image-only PDFs.
- No destructive database actions or schema changes.