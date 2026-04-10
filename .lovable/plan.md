
# Fix AI Extract to Show Exact Source Values From the Uploaded File

## What’s actually wrong
The current fix only avoids some rounding, but it still relies on values that were already parsed/normalized. That means the app is not showing the true original spreadsheet values.

Two root causes remain:
1. `raw_total_length_mm` / `raw_dims_json` are numeric “pre-conversion” values, not the exact source text from the file.
2. Conversion is still driven by a session-level unit, but your rule is per-cell:
   - `"` = inches
   - `'` = feet
   - no symbol = millimeters

That means the system must preserve and display the original cell text, not reformat parsed numbers.

## Plan

### 1. Store the exact source values from the spreadsheet
Add new fields on `extract_rows` for the original displayed values from the uploaded file, for example:
- `source_total_length_text`
- `source_dims_json`

These will store the exact visible values from the file, such as:
- `149`
- `54"`
- `6'`
- `3'-5"`

This is necessary because the current numeric raw fields cannot preserve feet/inch marks or exact formatting.

### 2. Read spreadsheet cell display text deterministically
Update `supabase/functions/extract-manifest/index.ts` so spreadsheet extraction does not rely on AI or parsed numeric values for LENGTH and dim columns.

Instead, for XLSX/CSV:
- detect the length and A/B/C/... columns as it already does
- read the actual displayed cell text from the workbook cells
- save that exact text into the new source fields
- still map by header name, not position

This will make the extract table match the original bar list for those columns.

### 3. Convert per cell only for internal normalized storage
Update the normalization/mapping logic in `supabase/functions/manage-extract/index.ts` so mm storage is derived from each cell’s original text, not from one session-wide unit.

New parsing rule:
- value ending with `"` → treat as inches
- value ending with `'` → treat as feet
- value with both feet/inches → parse as ft-in
- value with no unit mark → treat as mm

This keeps internal calculations usable while preserving exact display from the source file.

### 4. Change AI Extract UI to show source text directly
Update `src/components/office/AIExtractView.tsx` so LENGTH and dimension columns display the new source text fields directly when available.

That means:
- no conversion for display
- no round-trip formatting
- no forced inch/ft/mm output for extracted values

Also remove or neutralize the unit label on these columns when showing source text, because rows may mix `mm`, `"` and `'`.

### 5. Support existing broken sessions
Because current sessions already stored the wrong representation, add a repair path for spreadsheet sessions:
- re-read the original uploaded file from stored extract file metadata
- backfill the new source-text fields
- recompute normalized mm values from those source strings

This avoids requiring a fresh upload just to fix the current session.

## Files likely involved
- `supabase/migrations/...` — add source text columns
- `supabase/functions/extract-manifest/index.ts` — capture exact spreadsheet cell text
- `supabase/functions/manage-extract/index.ts` — per-cell unit parsing and normalization
- `src/lib/extractService.ts` — expose new source fields to the frontend
- `src/components/office/AIExtractView.tsx` — render original values directly

## Technical notes
- The current `raw_total_length_mm` / `raw_dims_json` naming is misleading for this requirement; they are not true source values.
- Session-level `unit_system` is not enough if rows/cells may use different notation.
- For this request, the display source of truth should be the original file text, not converted mm and not AI-parsed numeric output.

## Validation checklist
After implementation, verify with the uploaded spreadsheet that:
- `149` displays as `149`
- `54"` displays as `54"`
- `6'` displays as `6'`
- `3'-5"` displays exactly as `3'-5"`
- values in the extract table match the source spreadsheet text for LENGTH and A/B/C/... columns
- mapped/validated sessions still keep correct internal normalized mm values for downstream logic
