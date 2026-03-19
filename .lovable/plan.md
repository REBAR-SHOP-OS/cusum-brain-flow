

# Add Unit System Toggle at Top of Mapping Panel

## Problem
The unit selector is buried inside the "Cut Length" mapping row as a tiny dropdown. Users miss it and dimensions get stored as raw decimals (584.2, 152.4) instead of being properly labeled/converted. The user wants **all four unit options visible at the top** as prominent toggle buttons.

## Changes

### 1. `src/components/office/BarlistMappingPanel.tsx`

**Add prominent unit toggle bar at the top of the panel** (right after the header, before the mapping grid):

- Display 4 large toggle buttons in a row: **mm** · **Inches** · **Feet** · **Imperial (ft-in)**
- Styled as a segmented control with the active option highlighted in primary color
- Remove the buried "Source unit" dropdown from inside the Cut Length mapping row

**Apply unit conversion to dimensions too** — currently `buildDimensionsJson()` copies raw values without conversion. Fix it to:
- Multiply dimension values by the same `lengthFactor` when source unit is not mm
- Round to nearest integer for storage consistency

**Add Imperial (ft-in) as a unit option**:
- Add `{ value: "imperial", label: "Imperial (ft-in)", factor: 1 }` to LENGTH_UNITS
- For imperial mode, parse values like `5'-8"` or decimal feet-inches and convert to mm
- Since the XLSX data comes in as total inches (per memory), imperial factor = 25.4 (same as inches)

### 2. Preview table updates

- Show the selected unit label in the LENGTH column header (e.g., "LENGTH (in)" or "LENGTH (mm)")
- Display dimension values in the preview using the source unit for readability

## Result
Users see 4 big buttons at the top, pick their unit system once, and all lengths + dimensions convert correctly on confirm.

