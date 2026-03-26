

# Fix: AI Estimate Still Producing $0 Quotes from Weight Summary PDFs

## Root Cause (3 issues)

### Issue 1: Useless-data fallback parses wrong text
Line 412 calls `parseWeightSummaryFallback(content)` where `content` is the AI's JSON response (e.g. `[{"bar_size":"10M","quantity":null,...}]`). The fallback regex looks for patterns like `10M = 261.74 kg` — these patterns exist in the original PDF text but NOT in a JSON array. The fallback finds nothing and the useless items remain.

### Issue 2: AI returns items with quantity=null, bypassing null-safe defaults
The DB error shows `quantity: null` despite `?? 1` guards. This happens because the AI explicitly returns `quantity: null` (not `undefined`). While `null ?? 1` should return `1`, the error log timestamps suggest the recently-added null guards may not have deployed successfully, OR the items bypass the calculation loop entirely.

### Issue 3: No raw PDF text available for fallback parsing  
The function sends the PDF as base64 to the AI but never stores the AI's text interpretation of the document. When the fallback needs to regex-parse for weight patterns, it has no useful text to work with.

## Fix — `supabase/functions/ai-estimate/index.ts`

### A. Extract weight data directly from AI JSON items (new approach)
Instead of relying on regex parsing of text, add a new fallback that extracts data from the AI's own JSON items. If items have `bar_size` but null weights/quantities, create proper SUM- items using the bar sizes and any weight hints from the AI response.

```ts
function rescueAIItems(items: any[]): EstimationItemInput[] {
  // Group by bar_size and sum any weight_kg hints
  const bySize = new Map<string, number>();
  for (const item of items) {
    const size = item.bar_size;
    if (!size || !MASS_PER_M[size]) continue;
    const w = parseFloat(item.weight_kg) || 0;
    bySize.set(size, (bySize.get(size) || 0) + w);
  }
  // Create SUM items from grouped data
  const rescued: EstimationItemInput[] = [];
  for (const [barSize, weightKg] of bySize) {
    if (weightKg <= 0) continue;
    const massPerM = MASS_PER_M[barSize];
    rescued.push({
      element_type: "mixed", element_ref: "Weight Summary",
      mark: `SUM-TOT-${barSize}`, bar_size: barSize,
      quantity: 1, cut_length_mm: Math.round((weightKg / massPerM) * 1000),
      weight_kg: weightKg, shape_code: "straight",
      hook_type_near: "none", hook_type_far: "none",
      lap_type: "none", num_laps: 0,
    } as any);
  }
  return rescued;
}
```

### B. Fix the useless-data fallback to try all sources
After the useless-data check, try three fallback sources in order:
1. `parseWeightSummaryFallback(content)` — existing (AI response text)
2. `rescueAIItems(extractedItems)` — NEW: extract from the AI's own JSON
3. If both fail, the items remain but with hardened null defaults

### C. Harden null defaults with `|| 1` instead of `?? 1`
Change all null-safe guards to use explicit Number coercion:
```ts
quantity: Number(item.quantity) || 1,
cut_length_mm: Number(item.cut_length_mm) || 0,
weight_kg: Number(item.weight_kg) || 0,
```
This catches `null`, `undefined`, `NaN`, empty strings, and `0` (for quantity only).

### D. Guard the insert with a pre-filter
Before inserting, filter out any items that still have null/undefined required fields:
```ts
const safeRows = itemRows.filter(r => r.quantity != null && r.quantity > 0);
```

## Result
- Weight summary PDFs: AI items with bar_size info but null quantities get rescued into proper SUM- items with real weights
- No more `NOT NULL` constraint violations on insert
- Downstream quotation generation sees real tonnage

## Files Changed
- `supabase/functions/ai-estimate/index.ts`

