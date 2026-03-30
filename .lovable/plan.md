

# Unit System Audit — Issues Found

## Current Architecture

```text
Source file → extract-manifest (detects unit: mm/in/ft/imperial)
  → extract_rows (raw values stored)
  → BarlistMappingPanel (user selects/confirms source unit)
  → manage-extract apply-mapping (converts raw → mm using factor)
  → extract_rows (converted mm values stored)
  → Display: AIExtractView line items / TagsExportView / PrintTags / DetailedListView
```

---

## Issue 1: Line Items Display Toggle Conflates Source Unit with Display Unit

**Location**: `AIExtractView.tsx` lines 2074-2091

The mm/in/ft/imperial toggle in the "Line Items" table uses `selectedUnitSystem` — the **same** state variable used for the source unit in the mapping panel. After mapping is applied (data converted to mm in DB), toggling this to "in" calls `formatLengthByMode(row.total_length_mm, "in")` which divides the already-converted mm value by 25.4. This is correct for **display** purposes.

**However**, `selectedUnitSystem` is also bound to `confirmedUnitRef` which feeds into `applyMapping()`. If the user toggles the display to "in" and then re-applies mapping (e.g. re-maps), it would re-convert using "in" as source unit — corrupting data.

**Severity**: Medium — only triggers if user re-applies mapping after toggling display unit.

## Issue 2: Inline Edit Saves Raw Input Without Unit Context

**Location**: `AIExtractView.tsx` lines 2189-2190

When editing `total_length_mm` inline, the input value is saved directly to DB as-is (line 831: `Number(fields.total_length_mm)`). If the display toggle shows "in" but the user enters "54" thinking it's inches, it saves as 54 mm. The input field has no unit indicator and no conversion logic.

Same issue for dimension columns (lines 2197-2198).

**Severity**: High — user enters values in displayed unit but they're saved as mm.

## Issue 3: Mapping Panel Preview Shows Raw DB Values — Misleading Header

**Location**: `BarlistMappingPanel.tsx` lines 336-341, 351, 366

The preview header says `LENGTH (mm)` or `LENGTH (in)` based on selected unit, but the actual values shown are **raw DB values** (no conversion applied). When source is "mm" but values are actually inches (e.g., 54), it shows `LENGTH (mm) = 54` which is misleading — it should clarify these are raw/unconverted values.

**Severity**: Low — by design per memory, but header label creates false impression.

## Issue 4: DetailedListView Uses Company Unit, Not Session Unit

**Location**: `DetailedListView.tsx` line 278

Dimension sub-labels use `useUnitSystem()` (company-level: metric/imperial) instead of the session's `unit_system`. If company is metric but session was imported as imperial, dimensions show "MM" labels on ft-in converted values.

**Severity**: Medium — incorrect labels when session unit differs from company unit.

## Issue 5: `sessionUnitToDisplay` Maps "in" and "ft" to "metric" — Possibly Wrong

**Location**: `unitSystem.ts` line 173

After `applyMapping`, all DB values ARE in mm. So displaying them as "metric" (raw mm) is technically correct. However, if a user imports an imperial barlist and expects to see ft-in on tags, the session unit is "in" → mapped to "metric" → tags show mm. The user must manually set "imperial" in the mapping panel for tags to show ft-in.

**Severity**: Low — correct by design but may confuse users importing inch-based barlists who expect imperial display.

## Issue 6: No Unit Conversion on ZPL Label Generation

**Location**: Need to verify in `generateZpl` — likely uses raw mm values and doesn't apply `sessionUnitToDisplay`.

**Severity**: Unknown — needs verification.

---

## Proposed Fixes

### Fix 1: Separate Display Unit from Source Unit (Critical)
- Add a new state `displayUnit` in `AIExtractView.tsx` for the line items toggle
- Keep `selectedUnitSystem` / `confirmedUnitRef` exclusively for the mapping panel's source unit
- The display toggle only changes `displayUnit`, never touches `confirmedUnitRef`

### Fix 2: Unit-Aware Inline Editing
- When inline editing with display unit ≠ mm, convert user input back to mm before saving
- Show the current display unit label next to the input field

### Fix 3: Clarify Mapping Preview Header
- Change preview header from `LENGTH (mm)` to `LENGTH (raw)` or `LENGTH (source)` to avoid implying values are in mm when they may not be

### Fix 4: Pass Session Unit to DetailedListView
- Thread the session's `unit_system` through to `DetailedListView` instead of using company-level `useUnitSystem()`

## Files to Change
1. `src/components/office/AIExtractView.tsx` — separate `displayUnit` state from `selectedUnitSystem`; unit-aware inline editing
2. `src/components/office/BarlistMappingPanel.tsx` — clarify preview header label
3. `src/components/office/DetailedListView.tsx` — accept session unit prop instead of company unit

