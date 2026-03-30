

# Unit System Audit — Remaining Issues

## Issues Found

### Issue 1: DetailedListView Uses Company-Level Unit Instead of Session Unit (HIGH)
**File**: `src/components/office/DetailedListView.tsx` line 27

`useUnitSystem()` reads from the company profile (metric/imperial). But cut plan items originate from extract sessions that may have a different unit. If company is metric but the barlist was imported as imperial, dimensions show "MM" sub-labels on values that should display as inches.

**Fix**: Accept an optional `sessionUnit` prop or resolve the unit from the linked extract session. Fall back to company unit when no session context is available.

### Issue 2: DetailedListView Inline Edit Saves Raw Input Without Unit Conversion (HIGH)
**File**: `src/components/office/DetailedListView.tsx` line 268

When editing `cut_length_mm` inline, the raw `parseInt(e.target.value)` is saved directly. If the display shows imperial but the user enters "54" (meaning 54 inches), it's stored as 54 mm — a 25.4× error.

Same issue for dimension edits on line 275.

**Fix**: Apply `displayModeToMm()` conversion before saving, matching the pattern already used in `AIExtractView.tsx`.

### Issue 3: Mapping Preview Shows "LENGTH (mm)" in Screenshot Despite Code Saying "LENGTH (raw)" (LOW)
**File**: `src/components/office/BarlistMappingPanel.tsx` line 349

The code already says `LENGTH (raw)` and `DIMS (raw)` — this was fixed in the previous audit. The screenshot may show a cached version. **No code change needed**, but worth verifying the deployed build is current.

### Issue 4: CSV Export Dimension Columns Have No Unit Labels (LOW)
**File**: `src/components/office/TagsExportView.tsx` line 118

CSV headers for dimension columns are just `A, B, C, D...` with no unit indication. The length column correctly shows `TOTAL LENGTH (mm)` or `TOTAL LENGTH (ft-in)`, but dimensions don't follow this pattern. Users importing the CSV may not know the unit.

**Fix**: Append `(mm)` or `(in)` to dimension column headers based on session unit.

### Issue 5: `sessionUnitToDisplay` Collapses "in" and "ft" to "metric" — No Way to Display Inches-Only (LOW)
**File**: `src/lib/unitSystem.ts` line 173

If a session's source unit was `"in"`, after mapping all values are stored as mm. `sessionUnitToDisplay("in")` returns `"metric"` → tags/print show raw mm values. This is technically correct (DB is mm), but if the user imported an inch-based barlist, they likely expect imperial display on tags.

**Fix (optional)**: Map `"in"` → `"imperial"` in `sessionUnitToDisplay` so tags auto-display as ft-in for inch-sourced barlists.

---

## Proposed Changes

### Fix 1 + Fix 2: DetailedListView — session unit awareness + inline edit conversion
**File**: `src/components/office/DetailedListView.tsx`
- Import `displayModeToMm` and `sessionUnitToDisplay` from `@/lib/unitSystem`
- Resolve the session's unit system from the linked cut plan's extract session (or accept as prop)
- Apply `displayModeToMm()` when saving inline edits for `cut_length_mm` and dimension values
- Update dimension sub-labels to use the resolved session unit

### Fix 3: CSV dimension headers
**File**: `src/components/office/TagsExportView.tsx`
- Change dimension headers from `A, B, C...` to `A (mm), B (mm)...` or `A (in), B (in)...` based on session unit

### Fix 4 (optional): Map "in" source → imperial display
**File**: `src/lib/unitSystem.ts`
- Change `sessionUnitToDisplay` to return `"imperial"` for `"in"` and `"ft"` source units

## Files to Change
1. `src/components/office/DetailedListView.tsx` — unit-aware inline editing + correct labels
2. `src/components/office/TagsExportView.tsx` — CSV dimension headers with unit
3. `src/lib/unitSystem.ts` — optionally map "in"/"ft" → imperial display

