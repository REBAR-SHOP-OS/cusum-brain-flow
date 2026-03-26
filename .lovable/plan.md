

# Fix AI Auto Quotation: Use Real Pricing Config

## Problem
The `ai-generate-quotation` edge function currently tells the AI to simply "apply a 15% margin on costs" — it ignores the company's actual pricing rules (tonnage brackets, cage pricing at $5,500/ton, 15% scrap, epoxy/galvanized doubles, shipping at $3/km, shop drawing tiers, etc.). This produces incorrect $0 or generic quotes.

## Root Cause
The system prompt in `ai-generate-quotation/index.ts` (line 97) is a generic instruction. It does not load the pricing config from `quote_pricing_configs` table nor embed the detailed pricing rules.

## Fix

### File: `supabase/functions/ai-generate-quotation/index.ts`

**A. Load pricing config from DB** (after fetching BOM, ~line 76)
```ts
const { data: pricingConfig } = await serviceClient
  .from("quote_pricing_configs")
  .select("pricing_data")
  .eq("company_id", companyId)
  .eq("is_active", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

If no config exists in DB, use the user's provided pricing JSON as a hardcoded fallback (embedded directly in the function).

**B. Replace the system prompt** (line 97) with the full pricing instructions from the user's config:
- Task description: price reinforcing steel using ONLY the config data
- Quote steps: scope identification → collect inputs → classify cages vs non-cage → apply scrap → use tonnage brackets → handle epoxy/galvanized → shipping calc → shop drawings
- Cage rule: $5,500/ton for cage steel, shop drawings separate
- Fabrication table: tonnage brackets from "Below 1" ($1,800/ton) down to "100+" ($1,500/ton)
- Straight rebar prices: 10M-30M by length
- Output format: Summary, Line Items (material, fabrication, cages, shop drawings, mesh, shipping), Subtotal/Tax/Grand Total, Assumptions & Exclusions

**C. Update user prompt** (line 101) to pass BOM data structured for the pricing engine:
- Group items by bar size with total weights
- Identify cage vs non-cage items
- Include total tonnage with 15% scrap added
- Pass the pricing config JSON so the AI has exact rates

**D. Expand tool schema** (line 112) to capture richer output:
- Add `scrap_percentage`, `shipping_cost`, `shop_drawing_cost` fields
- Add `assumptions` array for the exclusions section
- Keep existing fields (line_items, notes, validity_days, delivery_terms)

**E. Update fallback logic** (line 172) to use tonnage bracket pricing instead of flat 15% margin when AI tool call fails.

## Result
- AI Auto quotes use the real Canadian rebar pricing rules
- Tonnage brackets determine $/ton (not a flat margin)
- Cages priced at $5,500/ton separately
- 15% scrap applied automatically
- Epoxy/galvanized at 2x rate
- Shipping calculated from distance
- Professional output with Assumptions & Exclusions section

## Files Changed
- `supabase/functions/ai-generate-quotation/index.ts` — load pricing config, replace prompt with full pricing rules, expand tool schema

