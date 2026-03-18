

## Plan: Fix Quote Engine Crash + Update Blitz Pricing Config

### Problem
1. **Crash**: `generateQuote()` accesses `req.shipping.truck_capacity_tons` (line 539) without null-checking `req.shipping`. When the AI omits the shipping object, it throws `TypeError: Cannot read properties of undefined`.
2. **Pricing config**: The user provided a comprehensive pricing JSON that should be embedded in the Blitz sales agent prompt so quotes use the correct rates.

### Changes

**1. `supabase/functions/_shared/quoteCalcEngine.ts`** — Add defensive defaults for `req.shipping` and `req.meta`/`req.project`

At the top of `generateQuote()` (after line 360), add:
```typescript
const shipping = req.shipping || { delivery_required: false, distance_km: 0, truck_capacity_tons: 0, notes: "" };
const project = req.project || { project_name: "", customer_name: "", site_address: "", quote_date: "", notes: "" };
const meta = req.meta || { request_id: "", quote_type: "quick", currency: "CAD", created_by: "agent", created_at: new Date().toISOString() };
```
Then replace all `req.shipping` references with `shipping`, `req.project` with `project`, `req.meta` with `meta`.

**2. `supabase/functions/_shared/agents/sales.ts`** — Embed the user's pricing config JSON into the Blitz system prompt

Add a new section after the "Quoting Instructions" block with the full pricing data (straight_rebars, dowels, ties_circular, fabrication_pricing, cage_pricing_rule, shipping rules). This way Blitz can reference exact prices when discussing with customers, and the quote engine also uses the stored `quote_pricing_configs` table for calculations.

### Files to Change
1. `supabase/functions/_shared/quoteCalcEngine.ts` — null-safe `req.shipping`, `req.project`, `req.meta`
2. `supabase/functions/_shared/agents/sales.ts` — embed pricing config in Blitz prompt

