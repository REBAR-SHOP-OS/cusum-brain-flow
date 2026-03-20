

## Fix: Enforce ft-in Display Across All Extract Views

### Problem

When "Imperial (ft-in)" is selected, multiple views still show raw mm numbers instead of formatted ft-in strings. Three root causes:

1. **TagsExportView.tsx `formatDim`** (line 34): treats stored mm as inches directly (`const totalInches = rounded`) — must divide by 25.4 first since all DB values are stored in mm after `applyMapping`.

2. **TagsExportView.tsx CSV export** (lines 106-109): exports raw mm numbers, never formats as ft-in.

3. **RebarTagCard.tsx** (line 60): displays raw `length` number with no unit formatting at all. Dims are also shown as raw numbers.

4. **AIExtractView.tsx results table headers**: "LENGTH" and dim column headers don't indicate the active unit (mm vs ft-in).

### Changes

**File: `src/components/office/TagsExportView.tsx`**

1. Fix `formatDim` (line 34): change `const totalInches = rounded;` to `const totalInches = rounded / 25.4;` — same fix as AIExtractView
2. Table display (lines 383-398): already uses `formatDim` with session unit — will work after fix #1
3. CSV export (lines 95-121): when `unit_system === "imperial"`, format `total_length_mm` and dim values using `formatDim` instead of raw numbers

**File: `src/components/office/RebarTagCard.tsx`**

4. Accept optional `unitSystem` prop
5. Format `length` display (line 60) using ft-in when imperial
6. Format dim values in the dims grid using ft-in when imperial
7. Add a small local `formatMmToFtIn` helper (same logic as other views)

**File: `src/components/office/TagsExportView.tsx` — Card view**

8. Pass `unitSystem` from `selectedSession.unit_system` to `RebarTagCard`

**File: `src/components/office/AIExtractView.tsx`**

9. Make LENGTH and dim column headers dynamic: show "LENGTH (ft-in)" or "LENGTH (mm)" based on `selectedUnitSystem`

### Files
- `src/components/office/TagsExportView.tsx` — fix `formatDim` mm→in conversion, imperial CSV export
- `src/components/office/RebarTagCard.tsx` — add unitSystem prop, format length + dims
- `src/components/office/AIExtractView.tsx` — dynamic table headers

