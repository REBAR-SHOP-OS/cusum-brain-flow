

## Fix: Imperial (ft-in) Display Shows mm Instead of Feet-Inches

### Root Cause — Two Bugs

**Bug 1: `formatDimForDisplay` in AIExtractView.tsx (line 61-79)**

The function assumes the input value is already in "total inches" for imperial:
```typescript
const totalInches = rounded; // WRONG — value is in mm, not inches
```
But after `applyMapping`, ALL values in the database are stored in **mm** (raw × lengthFactor). So for imperial data, `total_length_mm = 1981` means 1981 mm, not 1981 inches. The function must first convert mm → inches by dividing by 25.4.

**Bug 2: BarlistMappingPanel.tsx preview table (lines 339-357)**

The preview table headers are hardcoded as "LENGTH (mm)" and "DIMS (mm)", and values are shown as raw mm numbers. When Imperial is selected, the values should display as ft-in formatted strings, and headers should reflect the display unit.

### Changes

**File: `src/components/office/AIExtractView.tsx`**

Fix `formatDimForDisplay`: convert mm → inches first, then format as ft-in:
```typescript
function formatDimForDisplay(val, unitSystem) {
  if (val == null || val === 0) return "";
  const rounded = Math.round(val);
  if (unitSystem === "imperial") {
    const totalInches = rounded / 25.4;  // mm → inches
    const feet = Math.floor(totalInches / 12);
    const rawInches = totalInches % 12;
    // ... rest of ft-in formatting unchanged
  }
  return String(rounded);
}
```

**File: `src/components/office/BarlistMappingPanel.tsx`**

1. Change header from "LENGTH (mm)" / "DIMS (mm)" to dynamic based on `lengthUnit` (e.g., "LENGTH (ft-in)" when imperial)
2. Format the preview values using ft-in formatting when `lengthUnit` is "imperial" — add a local formatting function similar to `formatDimForDisplay`
3. The preview still stores mm internally, but **displays** in the user's chosen unit

### Files
- `src/components/office/AIExtractView.tsx` — fix mm→inches conversion in `formatDimForDisplay`
- `src/components/office/BarlistMappingPanel.tsx` — dynamic headers + ft-in formatted preview values

