

## Plan: Display Lengths in Source Unit — No Conversion

### Problem
The table always shows "Length (m)" and "+ Waste (m)" with values converted to meters, regardless of the selected source unit.

### Changes — Single File: `src/components/office/OrderCalcView.tsx`

**1. Rename `SizeSummary` fields** from `total_length_m` / `length_with_waste_m` to `total_length` / `length_with_waste` (unit-agnostic).

**2. Update `calculate()` display values** — divide mm totals by `unitFactor` (not by 1000):
```
// Current (always meters):
totalM = sum / wasteMult / 1000
// Fixed (source unit):
totalSource = sum / wasteMult / unitFactor
```

**3. Dynamic column headers** based on `sourceUnit`:
- `mm` → "Length (mm)", "+ Waste (mm)"
- `ft` → "Length (ft'in)", "+ Waste (ft'in)"  
- `in` → "Length (in)", "+ Waste (in)"

**4. Add ft+inch formatting** — when source unit is `ft`, display values as `X'-Y"` format (feet and inches) rather than decimal feet.

**5. CSV export** — use the same dynamic unit label in CSV headers.

### What does NOT change
- Bin-packing algorithm (stays in mm internally)
- Stock length display (6M / 12M / 18M)
- Weight calculation (stays in kg)
- Upload/parse logic
- Summary cards

