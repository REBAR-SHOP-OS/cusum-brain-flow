

# Strengthen Style & Product Enforcement in Image Generation

## Problem
The style and product selections from the UI are injected into prompts, but the AI image model sometimes ignores them because:
1. The override text gets buried in a long prompt with many competing instructions
2. The `generate_image` tool definition doesn't mention style/product as parameters, so the AI agent may not pass them through
3. No validation that the generated image actually matches the requested style

## Changes

### 1. `supabase/functions/_shared/agentTools.ts` — Add style/product parameters to tool definition
Add `style` and `products` parameters to the `generate_image` tool so the AI agent explicitly passes them:
```typescript
style: { type: "string", description: "Visual style the user selected (e.g. cartoon, realism, painting)" },
products: { type: "string", description: "Products the user selected to feature" }
```

### 2. `supabase/functions/_shared/agentToolExecutor.ts` (~line 527-574) — Restructure prompt priority
Move the style/product override to be the **very first line** of the prompt and wrap in emphatic markers. Also use the tool's own `style`/`products` args as additional signal:
- Restructure so that style+product block comes BEFORE the user's free-text prompt
- Add separator: `"=== END MANDATORY REQUIREMENTS ===\n\n"` before the rest of the prompt
- Use double enforcement: both from context AND from tool args

### 3. `supabase/functions/ai-agent/index.ts` (~line 914-953) — Strengthen social agent system prompt injection
Make the socialStyleOverride more emphatic with repeated emphasis and place it as a dedicated system message (separate from other context) so it has higher weight:
- Change from appending to `dynamicContext` string → inject as a separate high-priority system message right before the user message
- Add: `"FAILURE TO FOLLOW THESE STYLE/PRODUCT SELECTIONS IS A CRITICAL ERROR."`

### 4. `supabase/functions/_shared/agents/marketing.ts` (~line 53-55) — Reinforce in base prompt
Add explicit instruction that when calling `generate_image`, the agent MUST include style and product selections in the prompt parameter itself, not rely on system context alone.

## Files
- `supabase/functions/_shared/agentTools.ts` — add style/products params to generate_image tool
- `supabase/functions/_shared/agentToolExecutor.ts` — restructure prompt with style/product as top priority
- `supabase/functions/ai-agent/index.ts` — inject style override as separate system message
- `supabase/functions/_shared/agents/marketing.ts` — reinforce tool-call instructions

