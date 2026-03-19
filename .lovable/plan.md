

# Fix: Display Dimensions in Original Imperial Format After Extraction

## Problem

The extraction correctly reads imperial dimensions from bar lists (e.g., `0'-4"`, `1'-5"`, `5'-8"`) but converts them to total inches for storage (4, 17, 68). The `AIExtractView` table then displays these raw numbers without converting them back to imperial format. The user sees `68, 4, 17, 13` instead of `5'-8", 0'-4", 1'-5", 1'-1"`.

The `TagsExportView` already has a working `formatDim` function that converts back — but `AIExtractView` never uses it.

## Changes

### 1. `src/components/office/AIExtractView.tsx` — Format dimensions and length for display

- Read `activeSession.unit_system` (already available on the session object)
- Create or import a `formatDim` helper that converts total-inches back to feet-inches for imperial sessions
- Apply it to:
  - **LENGTH column** (line ~2034): format `row.total_length_mm` as `X'-Y"` when imperial
  - **Dimension columns A–R** (line ~2043): format each `dim_*` value as `X'-Y"` when imperial
- Keep raw numeric display for metric sessions
- Keep inline edit inputs as raw numbers (no formatting needed in edit mode)

### 2. Handle fractional inches in display

The source documents contain values like `1'-6½"`, `4'-10½"`. The current `parseDimension` converts `1'-6½"` by parsing the ½ fraction. The display formatter needs to handle half-inch precision:
- If the stored value has a `.5` fractional part, display as `X'-Y½"` 
- This applies to both `formatDim` in `AIExtractView` and the existing one in `TagsExportView`

### Technical detail

```text
Storage: dim_a = 4 (total inches from 0'-4")
Display: formatDim(4, "imperial") → "0'-4""

Storage: total_length_mm = 68 (total inches from 5'-8")  
Display: formatDim(68, "imperial") → "5'-8""

Storage: dim_b = 18.5 (total inches from 1'-6½")
Display: formatDim(18.5, "imperial") → "1'-6½""
```

No database changes needed — the data is stored correctly, only the display layer needs the formatting applied.

