

# Fix: AI Quote Generation from Weight Summary PDFs

## Problem
The uploaded PDF is a **weight summary report** (not a detailed shop drawing). It contains:
- Bar size weights: 10M=261.74kg, 15M=18,657.43kg, 20M=25,858.14kg
- Element breakdown: Raft Slab=27,201kg, Wall=9,309kg, etc.
- Grand Total: 44,777 kg (44.78 tons)

The `ai-estimate` function's extraction prompt expects **individual bar callouts** (marks, quantities, cut lengths, bend types). A summary PDF produces 0 extracted items → 0 kg project → $0 quote.

## Root Cause
The extraction prompt in `ai-estimate/index.ts` (line 156) only describes how to extract individual rebar items from shop drawings or tabular schedules with per-bar details. It has no instruction for handling **weight summary documents** that only contain aggregated totals.

## Fix

### File: `supabase/functions/ai-estimate/index.ts`

**A. Add summary document handling to the extraction prompt** (after the "TABULAR ESTIMATION FILES" section, ~line 199)

Add a new section:

```
## WEIGHT SUMMARY / ESTIMATE SUMMARY DOCUMENTS
If the document is a weight summary report or estimate summary (contains tables like 
"Weight Summary Report", "Element wise Summary", "Grand Total (Kgs/Tons)"):
- This is NOT a detailed bar schedule — it contains aggregated weights only
- Create ONE item per element per bar size combination
- For each element row (e.g. "RAFT SLAB: 27201.09 kg"), create items distributing 
  the weight proportionally across bar sizes based on the bar size weight table
- If only total weights per bar size are given (no per-element breakdown by size), 
  create one item per bar size with the total weight
- Set mark to "SUM-{element_abbrev}-{bar_size}" (e.g. "SUM-RS-15M")
- Set quantity to 1
- Set shape_code to "straight"
- Calculate cut_length_mm from weight: weight_kg / (mass_kg_per_m * quantity) * 1000
  Use approximate mass: 10M=0.785, 15M=1.570, 20M=2.355, 25M=3.925, 30M=5.495 kg/m
- Set element_type from the element name (RAFT SLAB→"slab", WALL→"wall", 
  GRADE BEAMS→"grade_beam", PIERS→"pier", etc.)
- Set element_ref from the element name
- Set weight_kg directly from the document's stated weight for that row
- CRITICAL: Preserve the exact weights from the document — do not recalculate
```

**B. Add a weight_kg pass-through in the calculation loop** (~line 293)

Currently, `calculateItem()` recalculates weight from dimensions. For summary items where `weight_kg` is already provided by AI, preserve it:

```ts
// After calculateItem
if (input.weight_kg && input.weight_kg > 0 && input.mark?.startsWith("SUM-")) {
  result.weight_kg = input.weight_kg;
  // Recalculate costs based on preserved weight
  const p = pricingMap.get(input.bar_size);
  if (p) {
    result.unit_cost = p.unit_price_per_kg || 0;
    result.line_cost = result.weight_kg * result.unit_cost;
  }
}
```

## Result
- Summary PDFs like the uploaded one will produce items with correct weights (44.78 tons total)
- The downstream `ai-generate-quotation` will then price these correctly using the tonnage brackets (~$1,600/ton for 30-50t range)
- Expected quote total: ~44.78t × $1,600/t = ~$71,648 + shop drawings + scrap

## Files Changed
- `supabase/functions/ai-estimate/index.ts` — enhance prompt for summary docs + preserve AI-provided weights

