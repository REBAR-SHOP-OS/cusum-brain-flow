

# Enforce User-Selected Style & Product in Image Generation

## Problem
When a user selects specific styles (e.g., cartoon, painting) and products (e.g., stirrups, cages) via the toolbar pills, the generated images sometimes don't match because:

1. **LLM ignores overrides**: Despite extensive prompting, the LLM sometimes generates a `prompt` text for `generate_image` that describes a different product or ignores the style
2. **Tool executor doesn't use brain reference images**: The deterministic slot flow uses brand/product reference images from Brain, but the tool-call flow does NOT — losing critical visual context
3. **Aspect ratio not forwarded**: The tool executor path doesn't use the user's aspect ratio selection
4. **Product conflict stripping is incomplete**: Only handles one product key, doesn't cover all naming variants

## Solution

### 1. Hard-override the prompt in `agentToolExecutor.ts` (lines 527-603)
Instead of just prepending a mandatory block and doing partial regex cleanup, **completely replace** the LLM's product references in the prompt when the user has made explicit selections. Add a nuclear override approach:

- When user selected products: Strip ALL product names from the LLM prompt, then inject the correct product description as the primary subject
- When user selected style: Strip any conflicting style descriptions (e.g., "photorealistic" when user chose "cartoon")
- Add aspect ratio from context to the image generation call
- Fetch and include brain resource images (same logic as deterministic path)

### 2. Strengthen the system prompt in `agents/marketing.ts`
Add a final enforcement line making it absolutely clear that the `style` and `products` parameters in the tool call are **not optional** and must exactly match user selections.

### Changes

**`supabase/functions/_shared/agentToolExecutor.ts`** — In the `generate_image` handler:
- After building `mandatoryBlock`, completely rewrite the LLM prompt's product section when user has selections — don't just prepend, replace the core subject
- Add aspect ratio injection from `context.imageAspectRatio`
- Fetch brain resource images (from `context.brainImageRefs` or query knowledge table) and attach as multimodal references
- Expand the conflicting product name list to cover more variants

**`supabase/functions/_shared/agents/marketing.ts`** — In the social agent prompt:
- Add stronger enforcement: "If user selections exist in context, you MUST pass them as `style` and `products` parameters. If you fail to do this, the image will be rejected."
- Add: "The `prompt` text MUST describe ONLY the user-selected product. Do not mention ANY other product by name."

**`supabase/functions/ai-agent/index.ts`** — In the deterministic slot flow (line ~843):
- Pass `imageAspectRatio` already works — verify consistency

### Key Technical Detail
The nuclear override in the tool executor will work like this:
```typescript
// When user selected products, replace ALL other product mentions
if (uProducts.length) {
  const ALL_PRODUCTS = ["stirrup", "cage", "hook", "dowel", "wire mesh", "fiberglass", "rebar straight", ...];
  const selectedDesc = uProducts.map(k => PRODUCT_PROMPT_MAP[k]).join("; ");
  // Remove every product mention from the LLM prompt
  for (const prod of ALL_PRODUCTS) {
    imagePrompt = imagePrompt.replace(new RegExp(prod + "s?", "gi"), "");
  }
  // Prepend: "PRIMARY SUBJECT: {selectedDesc}"
  imagePrompt = `MANDATORY: Image must show ${selectedDesc}\n\n` + imagePrompt;
}
```

This ensures that even if the LLM writes "a beautiful rebar cage in a factory", when the user selected "stirrups", the cage reference gets stripped and stirrups are enforced.

