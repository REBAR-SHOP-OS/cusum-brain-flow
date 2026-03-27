

# Fix: OCR Total Weight Mismatch (7.71t → 5.661t)

## Root Cause Analysis

Three compounding bugs explain why the quotation Qty shows **5.661 tonnes** instead of the expected **~8.87 tonnes** (7.71 × 1.15):

### Bug 1: lbs vs kg unit confusion
The PDF's "Black wgt" column is in **lbs** (total = 17,006.90 lbs = 7,712.88 kg). The AI extraction prompt says "Set weight_kg directly from the document's stated weight" — but never instructs the model to detect units and convert lbs → kg. If the AI picks up values from the wrong column/unit, weights are wrong.

### Bug 2: Double waste/scrap application
- `ai-estimate` applies `waste_factor_pct` (default **5%**) to all item weights **before** storing to DB (line 657-659: `applyWasteFactor`)
- `ai-generate-quotation` reads those already-wasted weights, then applies `scrap_percent` (default **15%**) **again** (line 163: `totalWithScrap = totalWeightKg * (1 + scrapPct / 100)`)
- Result: items are inflated by both factors but the Qty label only says "incl. 15% scrap"

### Bug 3: `parseWeightSummaryFallback` has no lbs detection
The regex fallback that scans AI response text for bar-size weights (line 36) matches numbers next to "10M", "15M" etc. but doesn't distinguish lbs from kg columns, potentially grabbing lbs values.

## Fixes

### 1. `supabase/functions/ai-estimate/index.ts` — AI prompt fix
Add explicit instruction in the weight summary section (line ~477):
```
- CRITICAL: If the document shows weights in lbs/pounds, you MUST convert to kg (1 lb = 0.453592 kg). 
  Look for column headers like "Black wgt", "Total lbs", "Weight (lbs)" to detect imperial units.
  Always output weight_kg in KILOGRAMS, never in pounds.
```

### 2. `supabase/functions/ai-generate-quotation/index.ts` — Remove double scrap
The estimation items already include the waste factor from `ai-estimate`. The quotation should NOT apply scrap again on top. Change line 161-164:

**Before:**
```typescript
const totalWeightKg = bomItems.reduce((s, i) => s + toNum(i.weight_kg), 0);
const scrapPct = Number(scrap_percent ?? ...);
const totalWithScrap = totalWeightKg * (1 + scrapPct / 100);
const totalTonnes = totalWithScrap / 1000;
```

**After:**
```typescript
// Items from ai-estimate already include waste_factor_pct (typically 5%)
// The user-specified scrap_percent REPLACES the waste — not additive
const rawWeightKg = bomItems.reduce((s, i) => s + toNum(i.weight_kg), 0);
const estWastePct = Number(project.waste_factor_pct ?? 5);
const baseWeightKg = rawWeightKg / (1 + estWastePct / 100); // Remove already-applied waste
const scrapPct = Number(scrap_percent ?? pricingConfig.scrap_percentage ?? 15);
const totalWithScrap = baseWeightKg * (1 + scrapPct / 100);
const totalTonnes = totalWithScrap / 1000;
```

This un-does the estimation waste and applies only the user's chosen scrap %. With the PDF's 7712.88 kg base weight and 15% scrap: 7712.88 × 1.15 / 1000 = **8.87 tonnes** — correct.

### 3. `supabase/functions/ai-estimate/index.ts` — Fallback parser lbs detection
Add lbs detection to `parseWeightSummaryFallback`: if the text contains "Total lbs" or "lbs" near the weight values, divide extracted weights by 2.20462.

## Files Changed
- `supabase/functions/ai-estimate/index.ts` — add lbs→kg conversion instruction to prompt + fallback parser lbs detection
- `supabase/functions/ai-generate-quotation/index.ts` — fix double scrap by backing out estimation waste before applying user scrap

