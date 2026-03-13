

# Fix Style & Product Enforcement in Image Generation

## Problem
There are two image generation paths, and both have issues:

1. **LLM free-text path** (when user types anything other than 1-5): The `generate_image` tool handler in `agentToolExecutor.ts` receives the LLM's prompt but does NOT inject the user's style/product selections. It relies entirely on the LLM including them — which often fails. The `socialStyleOverride` in the system prompt is a hint, but the LLM frequently ignores it.

2. **Deterministic slot path** (when user types 1-5): The style/product ARE in the image prompt, but the output title still shows default slot product (`slot.product`) instead of the overridden one (`effectiveSlotProduct`).

## Changes

### 1. `supabase/functions/_shared/agentToolExecutor.ts` — `generate_image` handler (~line 521-568)
Inject style/product overrides directly into the image prompt when `context.imageStyles` or `context.selectedProducts` exist:

```typescript
// After line 527 (const imagePrompt = args.prompt || ...)
// Build mandatory style/product prefix from user selections
let styleProductPrefix = "";
if (agent === "social" && context) {
  const IMAGE_STYLE_MAP = { /* same 10 styles */ };
  const PRODUCT_PROMPT_MAP = { /* same 7 products */ };
  const NON_REALISTIC = ["cartoon","animation","painting","ai_modern"];
  
  const uStyles = (context.imageStyles as string[]) || [];
  const uProducts = (context.selectedProducts as string[]) || [];
  
  if (uStyles.length) {
    const desc = uStyles.map(k => IMAGE_STYLE_MAP[k] || k).join(". ");
    const isNonRealistic = uStyles.some(s => NON_REALISTIC.includes(s));
    styleProductPrefix += `MANDATORY STYLE: ${desc}. `;
    if (isNonRealistic) {
      styleProductPrefix += `This is a NON-PHOTOREALISTIC style — do NOT make photorealistic. `;
    }
  }
  if (uProducts.length) {
    const desc = uProducts.map(k => PRODUCT_PROMPT_MAP[k] || k).join("; ");
    styleProductPrefix += `MANDATORY PRODUCT FOCUS: ${desc}. `;
  }
}
const finalPrompt = styleProductPrefix + imagePrompt + "\n\nIMPORTANT: Place the text ...";
```

This ensures that even when the LLM generates a generic prompt, the style/product are prepended as mandatory instructions to the image model.

### 2. `supabase/functions/ai-agent/index.ts` — Slot title fix (~line 840-841)
Change `slot.product` to `effectiveSlotProduct` in the output markdown so the title reflects the user's selection:

```typescript
// Before:
`### Slot ${slot.slot} — ${slot.product}\n\n`
// After:
`### Slot ${slot.slot} — ${effectiveSlotProduct}\n\n`
```

Same fix on line 849 for the error case.

### Files
- `supabase/functions/_shared/agentToolExecutor.ts` — inject style/product into image generation prompt
- `supabase/functions/ai-agent/index.ts` — fix slot title to show user-selected product

