

# Rebar Sales Quoting Engine -- Implementation Plan

## Overview

Build a standalone, deterministic rebar quoting engine (edge function + pricing config table + UI) that takes structured JSON input (straight bars, fabricated bars, cages, dowels, ties, mesh, shipping) and produces a sales-ready quote with line items, spreadsheet table, and totals. This is separate from the existing AI drawing-takeoff module -- no AI/vision involved, pure pricing math from a `pricing_config` JSON stored in the database.

## What Already Exists

- `rebar_sizes` table with Canadian metric bar data (10M-55M, mass_kg_per_m)
- `rebar_standards` table with hook/lap multipliers
- `estimation_projects` + `estimation_items` tables (AI takeoff results)
- `estimation_pricing` table (currently empty -- material_cost_per_kg, labor rates)
- `quotes` table with quote_number, customer_id, total_amount, metadata JSONB
- `convert-quote-to-order` edge function
- `rebarCalcEngine.ts` shared module (hook/lap/weight math)

## Step 1: Pricing Config Table

Create a `quote_pricing_configs` table to store the full pricing ruleset per company:

- `id` UUID PK
- `company_id` UUID (FK)
- `config_name` TEXT (e.g. "Default 2026")
- `is_active` BOOLEAN DEFAULT true
- `pricing_data` JSONB -- contains the full pricing config:
  - `straight_rebars`: array of {bar_size, length_ft, price_each_cad}
  - `fabrication_pricing.price_table`: array of {min_ton, max_ton, price_per_ton_cad}
  - `fabrication_pricing.shop_drawing_per_ton_cad`
  - `dowels`: array of {type, size, price_each_cad}
  - `ties_circular`: array of {type, diameter, price_each_cad}
  - `cage_price_per_ton_cad`: 5500
  - `coating_multipliers`: {epoxy: 2, galvanized: 2, black: 1}
  - `shipping_per_km_cad`: 3
  - `default_truck_capacity_tons`: 7
  - `default_scrap_percent`: 15
- `created_at`, `updated_at` TIMESTAMPTZ

RLS: company-scoped read/write.

## Step 2: Quote Engine Edge Function

Create `supabase/functions/quote-engine/index.ts` with 3 action modes:

### POST /quote-engine `{action: "validate"}`
- Validate the `estimate_request` JSON against required fields
- Return `missing_inputs_questions` if critical inputs are missing (bar sizes not in pricing config, zero quantities, missing distances, etc.)

### POST /quote-engine `{action: "quote"}`
Pipeline:
1. Load active `quote_pricing_configs` for the company
2. Load `rebar_sizes` for mass_kg_per_m lookups
3. **Straight bars**: Look up each line in `pricing_config.straight_rebars` by bar_size + length_ft, multiply by quantity
4. **Fabricated bars**: Compute weight per bar (length_ft to mm, then mass_kg_per_m), multiply by quantity, add 15% scrap, sum total non-cage tonnage, select fabrication bracket from `price_table`, apply coating multiplier (2x for epoxy/galv)
5. **Dowels**: Look up each in `pricing_config.dowels` by type+size, multiply by quantity
6. **Ties circular**: Look up each in `pricing_config.ties_circular` by type+diameter, multiply by quantity
7. **Cages**: Weight per cage * quantity, add 15% scrap, price at CAD 5,500/ton (from config). Never mixed into fabrication tonnage brackets
8. **Shop drawings**: If required, total non-cage tonnage * shop_drawing_per_ton_cad
9. **Shipping**: distance_km * 3 CAD * ceil(total_tonnage / truck_capacity)
10. **Tax**: Apply tax_rate to subtotal if provided
11. Persist to `quotes` table with full breakdown in `metadata` JSONB
12. Return: quote_id, summary, line_items, spreadsheet_table, weights_summary, pricing_method_summary, assumptions_and_exclusions

### POST /quote-engine `{action: "explain"}`
- Return plain-English explanation of how the quote was calculated

## Step 3: Calculation Module

Create `supabase/functions/_shared/quoteCalcEngine.ts`:

- `computeStraightBarPrice(line, pricingConfig)` -- lookup exact match
- `computeFabricatedWeight(line, rebarSizes)` -- ft to mm, mass_kg_per_m * qty
- `selectTonnageBracket(totalTons, priceTable)` -- find matching bracket
- `computeCagePrice(cage, config)` -- weight * qty * scrap * 5500/ton
- `computeShipping(distKm, totalTons, truckCap, ratePerKm)`
- `applyCoatingMultiplier(baseCost, coatingType, multipliers)`
- `applyScrap(weightKg, scrapPct)` -- weight * (1 + scrapPct/100)
- `buildSpreadsheetTable(lineItems)` -- format into the 10-column table
- `buildAssumptions(request)` -- generate assumptions/exclusions text

All deterministic, no AI. Uses only the provided pricing_config JSON.

## Step 4: Quote UI Page

Create `src/pages/QuoteEngine.tsx` with:

- **Tab 1 -- New Quote**: Form-based input matching the `estimate_request` template
  - Project details (name, customer, address)
  - Scope sections: straight bars, fabricated bars, dowels, ties, cages, mesh -- each with add/remove line buttons
  - Coating selector (black/epoxy/galvanized)
  - Shipping distance input
  - "Validate" button (calls validate action) and "Generate Quote" button
- **Tab 2 -- Results**: 
  - Summary cards (total weight, total cost, shipping, tax)
  - Spreadsheet-style table matching the 10 required columns
  - Assumptions and exclusions section
  - Export and "Convert to Order" buttons
- **Tab 3 -- History**: Past quotes from the `quotes` table where source = 'quote_engine'

Add route `/quote-engine` to App.tsx.

## Step 5: Seed Default Pricing Config

Insert a default pricing config via migration data seed for the primary company. The user will need to provide actual pricing values, but we will set up the structure with placeholder prices that can be edited.

## Step 6: Agent Integration

Add a `generate_sales_quote` tool to the estimation agent tools so the Gauge agent can trigger the quote engine from chat with structured input.

## Technical Details

### Weight Calculation (Canadian Metric)
- Bar weight: `length_ft * 0.3048 * mass_kg_per_m` (convert ft to m, then multiply by kg/m from `rebar_sizes`)
- Tonnage: `total_weight_kg / 1000`
- Scrap: `tonnage * 1.15` (15% default)

### Fabrication Pricing Logic
```text
1. Sum all fabricated bar weights (after scrap)
2. Convert to tons
3. Find bracket in price_table where min_ton <= total <= max_ton
4. Non-cage fab cost = total_tons * bracket_price_per_ton
5. If epoxy/galv: fab cost *= 2
```

### Cage Pricing (always separate)
```text
cage_tonnage = sum(cage_weight_kg * qty) * 1.15 / 1000
cage_cost = cage_tonnage * 5500
```

### Shipping
```text
trips = ceil(total_tonnage / truck_capacity_tons)
shipping_cost = distance_km * 3 * trips
```

### Output JSON Shape
```text
{
  quote_id, summary, line_items[], spreadsheet_table[],
  weights_summary: {straight_kg, fabricated_kg, cage_kg, total_kg, total_tons, scrap_tons},
  pricing_method_summary: {tonnage_bracket_used, cage_rate, coating_multiplier, shipping_trips},
  assumptions_and_exclusions: string[],
  missing_inputs_questions: string[] | null
}
```

## Implementation Sequence

| Step | What | Effort |
|------|------|--------|
| 1 | Database: quote_pricing_configs table + RLS + seed | 30 min |
| 2 | quoteCalcEngine.ts (deterministic pricing math) | 1 hour |
| 3 | quote-engine edge function (validate/quote/explain) | 1.5 hours |
| 4 | QuoteEngine UI page + route | 2 hours |
| 5 | Agent tool integration | 30 min |
| **Total** | | **~5.5 hours** |

