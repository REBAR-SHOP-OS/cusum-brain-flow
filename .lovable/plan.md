

# Enforce Style & Product Selections for Free-Text Pixel Messages

## Problem
When the user selects a Style + Product and types **free text** (not a slot number 1-5), the message bypasses the deterministic image generation path and goes to the LLM. The LLM's system prompt (in `marketing.ts`) has a hardcoded "ALL images MUST be PHOTOREALISTIC" rule and doesn't dynamically adapt to user-selected styles/products. The style/product data IS passed in the context object, but the LLM may ignore it.

The deterministic path (slot numbers) already handles this correctly — the fix from the previous session added conditional realism rules there. But the LLM path has no equivalent logic.

## Changes

### 1. `supabase/functions/ai-agent/index.ts` (~line 908-928)
Before sending messages to the LLM for the `social` agent, inject a **high-priority dynamic system directive** based on user-selected styles/products from context:

```typescript
// After line ~915 (dynamicContext building), before messages array
let socialStyleOverride = "";
if (agent === "social") {
  const uStyles = (mergedContext.imageStyles as string[]) || [];
  const uProducts = (mergedContext.selectedProducts as string[]) || [];
  
  if (uStyles.length || uProducts.length) {
    const IMAGE_STYLE_MAP = { /* same map as line 755 */ };
    const PRODUCT_MAP = { /* same map as line 774 */ };
    const styleDesc = uStyles.map(k => IMAGE_STYLE_MAP[k] || k).join(". ");
    const productDesc = uProducts.map(k => PRODUCT_MAP[k] || k).join("; ");
    const NON_REALISTIC = ["cartoon","animation","painting","ai_modern"];
    const isNonRealistic = uStyles.some(s => NON_REALISTIC.includes(s));
    
    socialStyleOverride = `\n\n## ⚠️ MANDATORY USER SELECTIONS — OVERRIDE ALL DEFAULTS\n`;
    if (uProducts.length) socialStyleOverride += `PRODUCT: ${productDesc}\n`;
    if (uStyles.length) socialStyleOverride += `STYLE: ${styleDesc}\n`;
    if (isNonRealistic) {
      socialStyleOverride += `CRITICAL: The user selected a NON-PHOTOREALISTIC style. You MUST follow "${styleDesc}" EXACTLY. IGNORE the photorealism rule. Do NOT make images look like real photographs.\n`;
    }
    socialStyleOverride += `When calling generate_image, your prompt MUST feature these products in this style. This overrides ALL default rules.\n`;
  }
}
```

Then append `socialStyleOverride` to the dynamic context that goes into the second system message.

### 2. `supabase/functions/_shared/agents/marketing.ts` (line ~54)
Add a clause to the IMAGE RULES section acknowledging user overrides:

```
- **STYLE OVERRIDE**: If the user context includes `imageStyles` or `selectedProducts`, those MUST take absolute priority. Use the specified style even if it contradicts the photorealism rule above. The user's explicit selection always wins.
```

### Files
- `supabase/functions/ai-agent/index.ts` — inject dynamic style/product override into LLM system prompt
- `supabase/functions/_shared/agents/marketing.ts` — add style override clause to Pixel prompt

