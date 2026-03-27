

# Fix Inaccurate OCR Total Weight in Quotation Pipeline

## Problem
The AI extraction pipeline (`ai-estimate`) does not sanitize numeric values from OCR/AI output. Values like `"1,234.56"`, `"261.74 kg"`, or `"18,657.43"` fail with `Number()` or `parseFloat()`, producing `NaN` → `0`, which corrupts the total weight and consequently the quotation tonnage (Qty field shows wrong value like 5.237).

## Root Cause
Three places in `ai-estimate/index.ts` parse AI-extracted numbers without handling commas, units, or locale artifacts:
- **Line 617-618**: `Number(input.quantity)` / `Number(input.cut_length_mm)` — no comma stripping
- **Line 642**: `(input as any).weight_kg` — AI may return `"1,234.56 kg"` as a string
- **Line 210**: `parseFloat(String(row[colMap.weight]))` — spreadsheet weights with commas

## Fix

### 1. Add `toNum()` sanitizer in `ai-estimate/index.ts`
```typescript
const toNum = (v: unknown) => Number(String(v ?? '').replace(/,/g, '.').replace(/[^\d.-]/g, '')) || 0;
```
This strips commas, units (`kg`, `KG`), spaces, and other non-numeric characters.

### 2. Apply `toNum()` at all numeric parsing points:
- **Line 617**: `input.quantity = toNum(input.quantity) || 1;`
- **Line 618**: `input.cut_length_mm = toNum(input.cut_length_mm) || 0;`
- **Line 642**: `const aiWeight = toNum((input as any).weight_kg);`
- **Line 210** (spreadsheet parser): `const weightRaw = colMap.weight >= 0 ? toNum(row[colMap.weight]) : 0;`
- **Line 204**: `const quantity = colMap.qty >= 0 ? (toNum(row[colMap.qty]) || 0) : 1;`
- **Line 207**: `const cutLengthRaw = colMap.length >= 0 ? toNum(row[colMap.length]) : 0;`

### 3. Defensive hardening in `ai-generate-quotation/index.ts`
- **Line 136**: `const weightKg = toNum(i.weight_kg);` (same sanitizer, even though DB stores numeric — belt and suspenders)
- **Line 148**: `barSizeGroups[barSize].count += toNum(i.quantity);`

## Files Changed
- `supabase/functions/ai-estimate/index.ts` — add `toNum()`, apply to all numeric parsing
- `supabase/functions/ai-generate-quotation/index.ts` — add `toNum()` for defensive weight parsing

