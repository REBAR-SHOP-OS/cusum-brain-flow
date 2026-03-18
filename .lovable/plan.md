

## Bug: Cage Quotes Return $0 — Auto-Weight Estimation Missing

### Root Cause

The quote engine prices cages using `total_cage_weight_kg`, but the Blitz agent prompt instructs the LLM to send `total_cage_weight_kg: 0` along with structural details (tie_bar_size, tie_diameter_inch, tie_quantity, vertical_bar_size, vertical_length_ft, vertical_quantity). The engine has no logic to compute weight from these structural fields, so it prices at 0 kg → $0.

The validation function catches this (`"total_cage_weight_kg is 0 or missing"`), but the Blitz prompt explicitly says **"NEVER use action: validate"** — it always goes straight to `action: "quote"`, bypassing validation entirely.

```text
User says: "12 cages 18" dia 10M ties"
  ↓
Blitz builds: { total_cage_weight_kg: 0, tie_bar_size: "10M", tie_diameter_inch: 18, ... }
  ↓
computeCagePrice: 0 kg × $5,500/ton = $0
  ↓
$0 guard triggers → "pricing failed"
```

### Fix

**1. Add auto-weight estimation to `computeCagePrice` in `quoteCalcEngine.ts`**

When `total_cage_weight_kg` is 0 but structural details are present, compute weight automatically:

- **Ties weight** = π × (diameter_inch × 0.0254) × mass_kg_per_m(tie_bar_size) × tie_quantity
- **Verticals weight** = vertical_length_ft × 0.3048 × mass_kg_per_m(vertical_bar_size) × vertical_quantity
- **Cage weight** = ties_weight + verticals_weight

This requires passing `rebarSizes` into `computeCagePrice` (currently it only receives config).

**2. Extend `CageLine` interface**

Add the structural fields the LLM already sends but aren't typed:
- `tie_bar_size?: string`
- `tie_diameter_inch?: number`
- `tie_quantity?: number`
- `vertical_bar_size?: string`
- `vertical_length_ft?: number`
- `vertical_quantity?: number`

**3. Update `generateQuote` cage loop**

Pass `rebarSizes` to `computeCagePrice`. Update the line item description to show the computed weight.

### Files Changed

- `supabase/functions/_shared/quoteCalcEngine.ts` — CageLine interface, computeCagePrice function, generateQuote cage section

No prompt changes needed — the Blitz prompt already sends the right structural data.

