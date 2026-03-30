

# Unit System Comprehensive Audit

## Current Architecture Summary

```text
Source file → extract-manifest (detects unit: mm/in/ft/imperial)
  → extract_rows (raw values)
  → BarlistMappingPanel (user selects source unit)
  → manage-extract apply-mapping (converts raw → mm)
  → extract_rows (mm values stored)
  → Display: AIExtractView, TagsExportView, DetailedListView, PrintTags, ZPL labels
```

All values in DB are stored as mm after mapping. Display should convert mm → user's preferred display unit.

---

## Issues Found

### Issue 1: DetailedListView `startEdit` Loads Raw mm Into Edit Fields (HIGH)
**File**: `src/components/office/DetailedListView.tsx` line 62-72

When the user clicks Edit, `startEdit` populates `editValues.cut_length_mm` with the raw DB value (mm). But the non-editing display shows `formatLength(item.cut_length_mm, unitSystem)` which converts to ft-in for imperial. So if unit is imperial and the DB has 1372 mm, the display shows `4'-6"` but the edit input shows `1372`. The user sees a confusing jump and might enter `54` thinking inches, but the save logic now converts it via `displayModeToMm(54, editUnit)` → `54 * 25.4 = 1372 mm`. This is actually **correct on save** but **confusing on load** — the edit field should show the display-unit value, not raw mm.

Same issue for `bend_dimensions` — edit fields show raw mm values.

**Fix**: Convert mm → display unit when populating edit fields in `startEdit`.

### Issue 2: DetailedListView Table Header Has No Unit Label (MEDIUM)
**File**: `src/components/office/DetailedListView.tsx` line 247

The "Length" column header doesn't indicate the unit. User can't tell if values are mm or inches. Compare with AIExtractView which shows `LENGTH (mm)` or `LENGTH (in)`.

**Fix**: Show `Length (mm)` or `Length (in)` based on `unitSystem`.

### Issue 3: DetailedListView Dimension Headers Have No Unit Labels (MEDIUM)
**File**: `src/components/office/DetailedListView.tsx` line 248

Dim column headers are just `A, B, C...` with no unit indication (unlike the sub-labels inside cells).

**Fix**: Add unit suffix to dim column headers or ensure consistency.

### Issue 4: OrderCalcView Assumes mm Input Without Unit Detection (MEDIUM)
**File**: `src/components/office/OrderCalcView.tsx` line 78-79

The parser uses a heuristic: `rawLen > 100 ? rawLen : rawLen * 1000`. This assumes values >100 are mm and <100 are meters. But if the uploaded file has inch values (e.g., 54 inches), `54 < 100` → treated as 54 meters → `54000 mm`. This is a 1000× error for imperial barlists.

No unit selection UI exists in OrderCalcView.

**Fix**: Add a source unit selector (mm/in/ft) to OrderCalcView and apply proper conversion.

### Issue 5: Optimization Config Labels Hardcoded as mm (LOW)
**File**: `src/components/office/AIExtractView.tsx` lines 2240-2273

Stock length dropdown shows `6M (6,000mm)`, `12M (12,000mm)`, `18M (18,000mm)`. Kerf label says `Kerf (mm)`, Min Remnant says `Min Remnant (mm)`. These are correct for metric but could confuse imperial users. Since optimization always works in mm internally, this is cosmetic.

**Fix (optional)**: Show imperial equivalents when session is imperial: `12M (39'-4")`.

### Issue 6: Mapping Preview Header Shows "LENGTH (mm)" in UI Despite Code Saying "LENGTH (raw)" (CONFIRMED NON-ISSUE)
**File**: `src/components/office/BarlistMappingPanel.tsx` line 349

The code correctly says `LENGTH (raw)`. The screenshot showing "LENGTH (mm)" is from a cached/stale build. No code change needed.

---

## Proposed Changes

### Fix 1: DetailedListView `startEdit` — Show Display-Unit Values in Edit Fields
**File**: `src/components/office/DetailedListView.tsx`
- In `startEdit`, convert `item.cut_length_mm` from mm to the display unit before setting it as edit value
- Same for each `bend_dimensions` value
- This way, what the user sees in the read-only column matches what appears in the edit input

### Fix 2 + 3: DetailedListView Header Labels
**File**: `src/components/office/DetailedListView.tsx`
- Change `<span>Length</span>` → `<span>Length ({unitSystem === "imperial" ? "in" : "mm"})</span>`
- Optionally add unit to dim headers

### Fix 4: OrderCalcView — Add Unit Selector
**File**: `src/components/office/OrderCalcView.tsx`
- Add a source unit toggle (mm / inches / feet) above the file upload
- Apply proper conversion factor instead of the `>100` heuristic
- This prevents 1000× errors when uploading inch-based barlists

### Fix 5 (optional): Optimization Config Imperial Labels
**File**: `src/components/office/AIExtractView.tsx`
- Show imperial equivalents in stock length dropdown when `displayUnit` is imperial

## Files to Change
1. `src/components/office/DetailedListView.tsx` — edit field conversion on load + header labels
2. `src/components/office/OrderCalcView.tsx` — add source unit selector
3. `src/components/office/AIExtractView.tsx` — optional: imperial labels in optimizer config

