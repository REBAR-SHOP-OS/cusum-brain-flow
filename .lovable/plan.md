

## Plan: Fix Blitz $0 Quotes — DB Update + Engine Hardening

### What's Wrong
1. **DB pricing is stale**: Old prices (10M 20' = $8.50) don't match user's config (10M 20' = $7.50). Missing 10' entries entirely.
2. **No type coercion**: `computeStraightBarPrice` uses strict `===` — if AI sends `"20"` (string) or `"15mm"`, no match → $0.
3. **Shop drawing pricing is flat** (`shop_drawing_per_ton_cad: 150`), but user's config is tiered ($500–$2500 by bracket, then formula for 50t+).

### Changes

**1. Update DB pricing data** (using insert tool — data update, not schema change)

Replace the active config row `faf51c67-...` with user's exact prices:
- Straight rebars: 10M (10'/20'), 15M (10'/20'), 20M (10'/20'), 25M (10'/20'), 30M (20') — with correct CAD prices
- Dowels: 15M 8"×24" = $2.99, 15M 24"×24" = $4.65
- Ties: 10M 8"–20" diameter ($3.75–$7.50)
- Fabrication tiers: Below 1t=$1800, 1–2t=$1750, ... 100+t=$1500
- Shop drawings: tiered per bracket (stored as `shop_drawing_cad` on each bracket row)
- Keep: cage=$5500/ton, scrap=15%, shipping=$3/km, truck=7t, coating black=1×, epoxy/galv=2×

**2. `quoteCalcEngine.ts` — Type coercion + fallback + tiered shop drawings**

- **`normalizeBarSize()`**: New helper — `"15mm"` → `"15M"`, `"15m"` → `"15M"`, already-correct `"15M"` passes through
- **`computeStraightBarPrice()`**: Coerce `line.length_ft` to `Number()`, normalize `line.bar_size` before matching
- **`PricingConfig` interface**: Change `shop_drawing_per_ton_cad: number` → add `shop_drawing_cad` field to each `price_table` entry (number or `{base: number, per_ton: number}`)
- **Shop drawing calc** (line 522–539): Look up shop drawing cost from the matching tonnage bracket instead of flat rate
- **Scope normalizer**: Coerce all numeric fields (`quantity`, `length_ft`, `cut_length_ft`, `total_cage_weight_kg`) to `Number()` to guard against string values from AI
- **Validation**: Apply same normalization in `validateEstimateRequest` so validation matches correctly too

**3. Deploy `quote-engine` edge function**

### Files
1. DB update via insert tool — `quote_pricing_configs` row
2. `supabase/functions/_shared/quoteCalcEngine.ts` — coercion, tiered shop drawings, normalization
3. Deploy `quote-engine`

