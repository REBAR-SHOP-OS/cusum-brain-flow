
## Root cause confirmed

I checked the live extraction data for your latest Office session (`63 Old Forest Hill`) and the problem is real in the database, not just the UI:

- `total_length_mm` is being saved as `8`, `7`, `5`
- `dim_a / dim_b / dim_c` are being saved as `6`, `4`, `1`
- `source_dims_json` is `null`
- `raw_dims_json` is also `null`

So the table is receiving small source-unit numbers instead of real millimeter values.

That is why the UI shows values like `0¼"` and `0⅛"`:
- the formatter assumes `6` means `6 mm`
- `6 mm` converted to imperial becomes about `0.24 in`
- so the UI renders near-zero imperial output

## Actual root cause

This is a 2-part extraction failure:

1. `overlaySheetDims()` is not capturing the exact source dimension cells for this `.xls` format  
   - so `source_dims_json` never gets populated
   - the UI loses the exact visible text from the source sheet

2. the extraction pipeline is still letting raw imperial numbers like `6`, `8`, `4`, `1` reach the DB length/dimension mm fields  
   - so the fallback formatter receives incorrect stored values
   - even when the session unit is `imperial`, the saved row data is still not normalized safely

There is also a structural weakness in the UI:
- when source text is missing, it blindly trusts `dim_*` and `total_length_mm`
- so if extraction ever slips again, the UI breaks again

## Implementation plan

### 1) Harden spreadsheet extraction at the source
Update `supabase/functions/extract-manifest/index.ts` so spreadsheet extraction becomes deterministic for this `.xls` format:

- expand header matching in `overlaySheetDims()` so it recognizes headers with unit suffixes, not only plain `A`, `B`, `C`
- use formatted cell text first, not raw numeric cell values, when reading dimensions and length
- parse from the exact visible spreadsheet text whenever possible
- populate:
  - `source_total_length_text`
  - `source_dims_json`
  - raw source-unit values for:
    - `raw_total_length_mm`
    - `raw_dims_json`
- convert source-unit values to true mm before insert into:
  - `total_length_mm`
  - `dim_a...dim_r`

### 2) Add a validation guard before saving rows
In the same extraction function, add a deterministic sanity check:

- if session unit is imperial/inch-based
- and stored mm fields are suspiciously tiny while source/unit evidence says imperial
- do not silently save bad values as final normalized data

This prevents future regressions from AI output, `.xls` quirks, or header mismatches.

### 3) Add a defensive UI fallback
Update `src/components/office/AIExtractView.tsx` so the table does not collapse into near-zero values if extraction data is incomplete:

- if source unit is imperial
- and source text/raw source values are missing
- and the stored numeric values look like unnormalized source-unit numbers
- format them as source-unit values instead of treating them as mm

This is not the main fix; it is a safety net so the UI stays stable even if extraction misses a case again.

### 4) Keep source-faithful rendering as highest priority
Preserve this display order:

1. exact source text from `source_dims_json` / `source_total_length_text`
2. raw source-unit values from `raw_dims_json` / `raw_total_length_mm`
3. converted mm fallback only if normalized data is truly valid

That makes the UI match the source sheet as closely as possible.

## Files to update

- `supabase/functions/extract-manifest/index.ts`
- `src/components/office/AIExtractView.tsx`

## What this will fix

After implementation:

- values like `6`, `4`, `1`, `8` will no longer be treated as millimeters
- dimensions will display like the source sheet instead of near-zero imperial values
- the exact ft/in/fraction text will be preserved when available
- this section of the UI will stop breaking when a spreadsheet format changes slightly

## Validation after implementation

I will verify these exact cases:

1. upload the same `.xls` file again
2. confirm DB rows store real mm values, not `8/6/4/1`
3. confirm `source_dims_json` is populated
4. confirm extracted table shows full imperial values instead of `0¼"`/`0⅛"`
5. confirm mapping/approval still work without double conversion
6. re-check the same rows end-to-end in the Office UI

## Important note

Your current extracted session is already saved with bad values, so after the fix the affected file/session must be re-extracted to fully correct the displayed data.
