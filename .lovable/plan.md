
## Fix: Unit Toggle Does Not Update Line Items Table

### Actual issue
The top unit toggle changes the mapping preview, but the lower “Line Items” table still shows mm values unless the selected unit is exactly `imperial`. So `in` and `ft` do not affect the table at all, and the UI becomes inconsistent.

### Root cause
There are two different unit-display implementations:

1. `BarlistMappingPanel.tsx` supports all 4 source units: `mm`, `in`, `ft`, `imperial`
2. `AIExtractView.tsx` line-items table only checks:
   - `selectedUnitSystem === "imperial"` → format as ft-in
   - otherwise → show raw mm

That means `in` and `ft` are ignored in the results table even when selected at the top.

### Files to update

**1) `src/components/office/AIExtractView.tsx`**
- Replace the current binary display logic (`imperial` vs `mm`) with full 4-mode formatting:
  - `mm` → show stored mm
  - `in` → show inches
  - `ft` → show feet
  - `imperial` → show ft-in
- Apply this consistently to:
  - merged rows table
  - line items table
  - length column header
  - dimension columns A–R
- Keep edit inputs stored in mm internally; only change display formatting in read mode

**2) `src/components/office/BarlistMappingPanel.tsx`**
- Keep the existing source-unit toggle behavior
- Align preview labels/headers with the same formatting rules used below so both sections behave identically

**3) `src/lib/unitSystem.ts`**
- Extend the shared formatting utilities so they support all units used in the extraction flow, not just metric vs imperial
- Centralize conversion/formatting helpers here so both the preview panel and line-items table use one source of truth

### Implementation approach
- Introduce a shared formatter like:
  - `formatLengthByMode(mm, "mm" | "in" | "ft" | "imperial")`
  - `lengthUnitLabelByMode(...)`
- Refactor `AIExtractView` to stop hardcoding `selectedUnitSystem === "imperial"`
- Refactor the mapping preview to use the same helper instead of its own separate formatter

### Result
After this fix:
- Top toggle and line items table will stay in sync
- Selecting `Inches` shows inches everywhere
- Selecting `Feet` shows feet everywhere
- Selecting `Imperial (ft-in)` shows ft-in everywhere
- Internal stored values remain mm, so data integrity is preserved

### Files
- `src/components/office/AIExtractView.tsx`
- `src/components/office/BarlistMappingPanel.tsx`
- `src/lib/unitSystem.ts`
