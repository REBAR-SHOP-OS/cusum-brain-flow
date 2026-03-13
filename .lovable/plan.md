

# Fix: User-selected style & product must strictly control image generation

## Problem
The `PIXEL_SLOTS` array hardcodes each slot's product (e.g., slot 2 = "Rebar Cages"). When a user selects "stirrups" + "realism" style and picks slot 2, the image prompt still uses "Rebar Cages" as the product focus because:

1. `generateDynamicContent(slot, ...)` uses `slot.product` to generate caption/slogan — ignoring user's product selection
2. The `PRODUCT FOCUS:` line at line 774 falls back to `slot.product` when no override exists, but even with override, the caption was already generated for the wrong product
3. The `effectiveStyle` override works but is buried among competing style directives

## Changes

### `supabase/functions/ai-agent/index.ts`

1. **Override slot product with user selection** (~line 628): Before the `for` loop body, when `userSelectedProducts` is set, override `slot.product` so that `generateDynamicContent` creates captions about the correct product:
   ```typescript
   const effectiveSlotProduct = userSelectedProducts?.length
     ? userSelectedProducts.map(k => PRODUCT_PROMPT_MAP[k] || k).join(" & ")
     : slot.product;
   ```

2. **Pass overridden product to `generateDynamicContent`** (~line 637): Replace `slot` with a modified slot object that uses `effectiveSlotProduct`

3. **Strengthen the image prompt priority** (~line 768-785): Move user-selected product/style blocks to the TOP of the prompt with `HIGHEST PRIORITY` markers, and make the instruction more explicit:
   ```
   ## HIGHEST PRIORITY — USER EXPLICITLY REQUESTED:
   STYLE: {effectiveStyle}
   PRODUCT: {productFocusOverride}
   The image MUST show exactly this product in this style. Override all other defaults.
   ```

4. **Move `userSelectedProducts` extraction earlier** (~line 760): Extract it before the loop so it's available for slot product override

### `supabase/functions/regenerate-post/index.ts`
Same priority strengthening for user product/style in the regeneration prompt.

### Files
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

