

# Fix: Null Quantity Causes Insert Failure in AI Estimation

## Problem
The edge function log shows:
```
null value in column "quantity" of relation "estimation_items" violates not-null constraint
```
The AI extracted 10 items successfully, but some items have `quantity: null` — the DB column requires a non-null value. This causes the entire batch insert to fail, resulting in 0 items saved and a "No rebar data could be extracted" error downstream.

## Root Cause
Line 498 in `supabase/functions/ai-estimate/index.ts`:
```ts
quantity: item.quantity,
```
No fallback for when the AI omits `quantity`. Same risk exists for other required fields like `cut_length_mm`, `bar_size`, etc.

## Fix — `supabase/functions/ai-estimate/index.ts`

Add null-safe defaults in the item row mapping (line 490-512):

```ts
quantity: item.quantity ?? 1,
cut_length_mm: item.cut_length_mm ?? 0,
total_length_mm: item.total_length_mm ?? 0,
hook_allowance_mm: item.hook_allowance_mm ?? 0,
lap_allowance_mm: item.lap_allowance_mm ?? 0,
weight_kg: item.weight_kg ?? 0,
unit_cost: item.unit_cost ?? 0,
line_cost: item.line_cost ?? 0,
page_index: (item as any).page_index ?? 0,
```

Also add the same guard earlier in the calculation loop (line 411) so `calculateItem` receives valid input:
```ts
input.quantity = input.quantity ?? 1;
input.cut_length_mm = input.cut_length_mm ?? 0;
```

## Result
- Items with missing `quantity` default to 1 instead of failing the insert
- The 10 items the AI successfully extracted will be saved
- Downstream quotation generation will see non-zero weight and produce a real quote

## Files Changed
- `supabase/functions/ai-estimate/index.ts` — add null-safe defaults for required DB columns

