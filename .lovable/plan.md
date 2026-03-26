

# Fix: Key Name Mismatch Between DB Pricing Config and Quote Generator

## Root Cause

The `getFabricationRate` function and line-item builder use hardcoded key names (`min`, `max`, `price_per_ton`, `shop_drawing_price`) from the fallback config, but the **actual DB pricing config** uses different keys:

| Code expects | DB has |
|---|---|
| `row.min` | `min_ton` |
| `row.max` | `max_ton` |
| `row.price_per_ton` | `price_per_ton_cad` |
| `row.shop_drawing_price` | `shop_drawing_cad` (or `shop_drawing_cad_formula`) |

Since `row.min` is `undefined`, `row.min ?? 0` = 0 and `row.max ?? 999999` = 999999, so the **first row always matches**. It returns `price_per_ton: undefined`. Then `59.221 * undefined` = `NaN`, serialized as JSON `null`. The `unit_price` field is `undefined` and gets dropped entirely.

**Proof from DB**: Quote QAI-2589 line items show `"amount": null` and missing `unit_price` for the rebar item, while shop drawings (hardcoded at 2500) work fine.

## Fix — `supabase/functions/ai-generate-quotation/index.ts`

### A. Update `getFabricationRate` to handle both key conventions

```ts
function getFabricationRate(tonnage: number, table: any[]) {
  for (const row of table) {
    const min = row.min ?? row.min_ton ?? 0;
    const max = row.max ?? row.max_ton ?? 999999;
    if (tonnage >= min && tonnage < max) {
      return {
        price_per_ton: row.price_per_ton ?? row.price_per_ton_cad ?? 1500,
        shop_drawing_price: row.shop_drawing_price ?? row.shop_drawing_cad ?? 
          (row.shop_drawing_cad_formula ? row.shop_drawing_cad_formula.base + tonnage * row.shop_drawing_cad_formula.per_ton : 2500),
      };
    }
  }
  return { price_per_ton: 1500, shop_drawing_price: 4500 };
}
```

### B. Also normalize the top-level config key access

Lines that read `pricingConfig.scrap_percentage`, `pricingConfig.shipping_per_km`, etc. need to also check the DB key variants (`default_scrap_percent`, `shipping_per_km_cad`, `default_truck_capacity_tons`, `cage_price_per_ton_cad`).

### C. Add NaN guard on line item amounts

Before pushing any line item, ensure `unit_price` and `amount` are valid numbers:
```ts
const unitPrice = fabRate.price_per_ton;
if (!unitPrice || isNaN(unitPrice)) throw new Error("Pricing config returned invalid unit price");
```

## Result
- Rebar line items will have correct `unit_price` (~$1,550/ton for 59t) and `amount` (~$91,793)
- Shop drawings will use the formula-based price for 50-100t range
- No more `null` amounts or missing `unit_price` fields

## Files Changed
- `supabase/functions/ai-generate-quotation/index.ts`

