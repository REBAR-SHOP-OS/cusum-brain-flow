

# Fix: Machine Max Bars Capacity Logic

## Problems Found

### 1. Dynamic reduction formula is wrong (CutterStationView.tsx:173-174)
```typescript
const maxBars = Math.max(1, Math.min(staticMaxBars, Math.floor(selectedStockLength / cut_length_mm)))
```
This divides stock length by cut length, producing "pieces per bar" — NOT "bars the machine can hold." For 12M stock / 2005mm cut = 5, so it shows max capacity 5 instead of 12. **These are unrelated concepts.**

- `max_bars` = how many bars the machine throat can hold simultaneously (from spec sheet)
- `pieces_per_bar` = how many cuts fit on one stock bar (from optimization)

**Fix**: Remove the dynamic reduction. Use `staticMaxBars` directly from `machine_capabilities`.

### 2. DB capacity doesn't match GENSCO spec sheet
Current DB for CUTTER-01 (DTX 400):
| Bar | DB | Spec Sheet |
|-----|-----|------------|
| 10M | 12 | **14** |
| 15M | 12 | **8** |

**Fix**: Update `machine_capabilities` to match the manufacturer spec sheet values. Also update `machineRegistry.ts` to match.

## Changes

### File: `src/components/shopfloor/CutterStationView.tsx`
- Line 173-175: Remove the `Math.floor(selectedStockLength / cut_length_mm)` reduction
- Simply use `staticMaxBars` as `maxBars`

### DB Migration
Update CUTTER-01 capabilities to match DTX 400 spec sheet:
- 10M: 12 → **14**
- 15M: 12 → **8**

### File: `src/components/shopfloor/machineRegistry.ts`
Update DTX 400 capacity to match spec sheet:
- 15M: 12 → **8**
- 25M: 6 → **2** (spec shows 2)
- 30M: 2 → **1** (spec shows 1)
- 35M: 1 → **1** (correct)

DTX 600 also needs verification:
- Current registry matches spec sheet (25→25, 20→16(wrong), etc.)

Actually let me re-read the spec sheet carefully:
DTX 400: 10mm=14, 12mm=12, 15mm=8, 20mm=6, 25mm=2, 30mm=1, 35mm=1
DTX 600: 10mm=25, 12mm=20, 15mm=16, 20mm=12, 25mm=6, 30mm=5, 35mm=4, 45mm=2, 55mm=1

Note: We use RSIC Canada codes (10M, 15M, 20M, 25M, 30M, 35M, 45M, 55M). The 12mm size doesn't exist in our system, so we skip it.

### Updated values

**machineRegistry.ts DTX 400:**
- 10M: 14 ✓ (already correct)
- 15M: 12 → **8**
- 20M: 8 → **6**
- 25M: 6 → **2**
- 30M: 2 → **1**
- 35M: 1 ✓

**machineRegistry.ts DTX 600:**
- 10M: 25 ✓
- 15M: 16 ✓
- 20M: 12 ✓
- 25M: 6 ✓
- 30M: 5 ✓
- 35M: 4 ✓
- 45M: 2 ✓
- 55M: 1 ✓
(All correct already)

**DB machine_capabilities for CUTTER-01 (DTX 400):**
- 10M: 12 → **14**
- 15M: 12 → **8**

**DB machine_capabilities for CUTTER-02 (DTX 400):**
- 20M: 8 → **6**
- 25M: 6 → **2**
- 30M: 4 → **1**
- 35M: 1 ✓

