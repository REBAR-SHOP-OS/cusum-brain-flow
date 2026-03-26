

# Fix: Root Cause — AI Returns Useless Items, Blocks Fallback & Produces Zero Weight

## Root Cause Chain

The PDF is a weight summary report. The AI prompt (lines 296-312) instructs the model to create `SUM-` prefixed items with back-calculated `cut_length_mm` and preserved `weight_kg`. But the AI ignores these instructions and returns 10 generic items with `quantity: null`, `cut_length_mm: null`, `mark: null`, `weight_kg: null`.

The cascade:
1. AI returns 10 items (all with null fields) → `extractedItems.length = 10`
2. Deterministic fallback (line 394) only runs if `extractedItems.length === 0` — **never triggers**
3. Null-safe defaults set `cut_length_mm = 0` → `calculateItem` computes `weight_kg = 0`
4. Weight preservation (line 439) only fires for `mark.startsWith("SUM-")` — these items have `mark: null`
5. All items have `weight_kg = 0` → `total_weight_kg = 0` → error thrown

## Fix — `supabase/functions/ai-estimate/index.ts`

### A. Detect useless AI items and trigger fallback (after line 401)
After the existing fallback block, add a second fallback check: if extracted items exist but ALL have zero/null weight AND zero/null cut_length, they're useless — discard them and re-run the deterministic weight summary parser on the raw AI response text.

```ts
// After line 401, add:
if (extractedItems.length > 0) {
  const hasUsefulData = extractedItems.some(item =>
    (item.cut_length_mm && item.cut_length_mm > 0) ||
    (item.weight_kg && item.weight_kg > 0) ||
    (item.quantity && item.quantity > 1)
  );
  if (!hasUsefulData) {
    console.log("AI returned items but all have zero weight/length — falling back to deterministic parser");
    const fallbackItems = parseWeightSummaryFallback(content);
    if (fallbackItems.length > 0) {
      extractedItems = fallbackItems;
      console.log(`Fallback replaced ${extractedItems.length} useless items with ${fallbackItems.length} summary items`);
    }
  }
}
```

### B. Broaden weight preservation (line 438-444)
Remove the `SUM-` mark requirement. If ANY item has an AI-provided `weight_kg > 0` but `calculateItem` produced 0 (because cut_length was 0), preserve the AI weight.

```ts
// Replace lines 438-444 with:
const aiWeight = (input as any).weight_kg;
if (aiWeight && aiWeight > 0 && result.weight_kg === 0) {
  result.weight_kg = Math.round(aiWeight * 1000) / 1000;
  const materialCost = p?.material_cost_per_kg ?? 0;
  result.unit_cost = Math.round(result.weight_kg * materialCost * 100) / 100;
  result.line_cost = Math.round(result.weight_kg * materialCost * 100) / 100;
}
```

### C. Also run fallback on the raw PDF text (not just AI response)
The deterministic parser currently only gets the AI response text. For weight summary PDFs, the raw content often has cleaner data. Pass the original base64 content through the fallback too if AI text fails. This is already covered by the `parseWeightSummaryFallback` function if the AI response echoes the PDF content.

## Result
- Weight summary PDFs: fallback parser creates proper `SUM-` items with real weights even when AI returns garbage
- Any item where AI provides weight but no cut_length: weight is preserved
- Downstream quotation generation sees real tonnage and prices correctly

## Files Changed
- `supabase/functions/ai-estimate/index.ts` — add useless-item detection + broaden weight preservation

