

# Add Delivery & Shop Drawing Options to AI Quotation Generator

## Problem
The AI quotation currently hardcodes shipping to $0 ("distance TBD") and always includes shop drawings. The user wants explicit controls for delivery distance and shop drawing inclusion so these line items appear correctly on generated quotes.

## Changes

### 1. `src/components/accounting/GenerateQuotationDialog.tsx`
Add two new input fields (visible in both tabs):
- **Delivery Distance (km)** — number input, optional, default empty (0 = no shipping line)
- **Include Shop Drawings** — checkbox, default checked

Pass both values to `ai-generate-quotation` via the body:
```ts
body: {
  estimation_project_id: ...,
  delivery_distance_km: deliveryDistance || 0,
  include_shop_drawings: includeShopDrawings,
  ...
}
```

### 2. `supabase/functions/ai-generate-quotation/index.ts`
Read `delivery_distance_km` and `include_shop_drawings` from the request body.

**Delivery line item** — if distance > 0:
- Calculate trips: `Math.ceil(totalTonnes / truckCap)`
- Shipping cost: `trips * distance * shippingPerKm * 2` (round trip)
- Add line item: "Delivery — {distance} km × {trips} trip(s)"

**Shop drawings** — only add the existing shop drawing line item when `include_shop_drawings !== false` (defaults to true for backward compatibility).

Store both values in quote metadata for reference.

## Result
- User can enter delivery distance (e.g. 50 km) and the quote will include a shipping line item calculated from the pricing config ($3/km)
- User can toggle shop drawings on/off
- Both appear as separate line items on the generated quotation
- Backward compatible: existing calls without these fields behave as before

## Files Changed
- `src/components/accounting/GenerateQuotationDialog.tsx` — add distance + shop drawing inputs
- `supabase/functions/ai-generate-quotation/index.ts` — compute delivery line item, conditionally include shop drawings

