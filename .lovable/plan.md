

# New Office Tool: Rebar Order Calculator

## What
A new "Order Calculator" section in the Office portal where the user uploads a barlist file (XLS/XLSX) and gets a summary of how many stock-length rebars to order, grouped by bar size — factoring in standard stock lengths (6M, 12M, 18M) and waste.

## How It Works
1. User uploads a RebarCAD XLS/XLSX file
2. Frontend parses it client-side using the `xlsx` library + the same column-detection logic from `rebarCADParser.ts`
3. Groups all items by bar size (10M, 15M, 20M, 25M, 30M, 35M)
4. For each bar size: calculates total linear meters needed, divides by selected stock length, rounds up → number of bars to order
5. Shows a summary table with: bar size, total pieces, total length (m), stock length, bars to order, total weight (kg)
6. Option to add a waste factor (e.g., 5-15%)
7. Export summary to CSV

## UI Design (matching existing dark theme)
- Header: "ORDER CALCULATOR" with file upload dropzone
- Stock length selector (6M / 12M / 18M toggle, like the optimization page)
- Waste factor slider (0-20%)
- Summary cards per bar size showing pieces, length, bars to order
- Total weight and total bars at bottom
- Export button

## Files Changed

| File | Change |
|---|---|
| `src/components/office/OfficeSidebar.tsx` | Add `"order-calc"` to `OfficeSection` type + sidebar entry |
| `src/components/office/OrderCalcView.tsx` | New — upload, parse, calculate, display order summary |
| `src/pages/OfficePortal.tsx` | Register `"order-calc"` in `sectionComponents` |

## Technical Details

### Parsing (client-side)
- Uses `xlsx` (already in dependencies) to read uploaded file
- Port the column-detection + bar-size normalization logic from `rebarCADParser.ts` to a client-side utility
- No edge function needed — pure client-side math

### Calculation Logic
```text
For each bar_size:
  total_cut_length_mm = Σ (cut_length_mm × quantity)
  total_with_waste = total_cut_length_mm × (1 + waste_pct/100)
  bars_needed = ceil(total_with_waste / stock_length_mm)
  total_weight = bars_needed × stock_length_mm × weight_per_meter / 1000
```

### Weight reference (from rebar_standards)
- Fetched from database on mount for accuracy
- Fallback to hardcoded values if offline

