

# Fix: `totalWeightKg is not defined` in ai-generate-quotation

## Root Cause
Line 176 uses `totalWeightKg` in a guard check, and line 180 references it in the error response. This variable was never declared — the actual computed weight variable is `rawWeightKg` (line 163) or `totalWithScrap` (line 167).

## Fix
In `supabase/functions/ai-generate-quotation/index.ts`, line 176-180:

Replace `totalWeightKg` with `rawWeightKg` (the pre-scrap total weight from BOM items):

```ts
// Line 176: change totalWeightKg → rawWeightKg
if (rawWeightKg <= 0 && bomItems.length === 0) {

// Line 180: change totalWeightKg → rawWeightKg  
total_weight_kg: rawWeightKg,
```

## File Changed
- `supabase/functions/ai-generate-quotation/index.ts` — replace 2 references to undefined `totalWeightKg` with `rawWeightKg`

