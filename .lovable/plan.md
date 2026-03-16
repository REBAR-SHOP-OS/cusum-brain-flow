

# Fix: Pixel Agent Must Generate Image on Short Commands Like "بساز"

## Problem
When the user selects a Style and Product via the toolbar pills and types a short command like "بساز" (Farsi for "create/build"), the Pixel agent doesn't recognize this as a command to immediately generate an image using the selected style/product. Instead, it asks clarifying questions (like "which slot?").

The style/product selections ARE already being passed correctly to the backend (via `extraContext.imageStyles` and `extraContext.selectedProducts`), and the enforcement logic in both the system prompt override and `agentToolExecutor.ts` is robust. The gap is in the **agent's base prompt** — it only describes slot-based generation and doesn't handle free-form "just create an image" commands.

## Fix

### 1. `supabase/functions/_shared/agents/marketing.ts` — Social (Pixel) agent prompt
Add a new section after the slot-based instructions (around line 12) that instructs Pixel to:
- Recognize short creation commands in any language (بساز, create, generate, make, build, etc.)
- When user has style/product selections active AND sends a short creation command → immediately call `generate_image` using those selections, WITHOUT asking for a slot number
- Use a random slot theme or the most contextually appropriate one

Add after line 11 (after "## WHEN USER SELECTS A SLOT"):

```
## WHEN USER SENDS A SHORT CREATION COMMAND
If the user types a short message like "بساز", "create", "generate", "build", "make an image", "عکس بساز", or any brief instruction to create content — AND the system context includes imageStyles or selectedProducts — you MUST:
1. **IMMEDIATELY call `generate_image`** — do NOT ask which slot, do NOT ask for clarification
2. Use the selected style and product from context as the primary creative direction
3. Pick a random slot theme for variety (or "Product promotional" as default)
4. Follow all the same image rules, caption format, and Persian translation requirements
This applies to ANY short message that implies "create something now" — the user's toolbar selections ARE their specification.
```

### 2. `supabase/functions/ai-agent/index.ts` — Enhance the socialStyleOverride (line 964)
Add an explicit instruction that short messages mean "generate now":

After line 965, add:
```
socialStyleOverride += `\nIMPORTANT: If the user's message is short (under 20 words) and implies creation (e.g. "بساز", "create", "generate", "make"), treat it as an IMMEDIATE command to call generate_image with the above style/product selections. Do NOT ask for slot number or any clarification.\n`;
```

These two changes ensure the AI agent understands that toolbar selections + short creation command = immediate image generation.

