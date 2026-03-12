

# Align Auto-Generate Image Prompts with Pixel Agent's Brain

## Problem
The `auto-generate-post` edge function has its own simplified image prompt rules (lines 231-238) that produce different-looking images than the Pixel agent. The agent's `marketing.ts` has much more detailed photorealistic rules, diverse visual style rotation, mandatory logo handling, and uniqueness constraints that the auto-generate function lacks.

## Change

### `supabase/functions/auto-generate-post/index.ts` — Replace IMAGE PROMPT RULES (lines 231-238)

Replace the current 7-line image prompt section with the full Pixel agent image rules from `marketing.ts` (lines 45-53), adapted for the auto-generate context:

- Copy the agent's photorealistic mandate, forbidden styles list, logo rules, visual uniqueness constraints, and diverse style rotation instructions verbatim
- Keep the existing `VISUAL_STYLES` array (lines 176-189) which already matches the agent's style list
- Add explicit instruction in the image_prompt generation to reference the assigned visual style for that slot
- No changes to caption rules, scheduling, platform rules, or any other logic

This is a prompt-only change in one file. No frontend or other backend changes.

## File Modified
- `supabase/functions/auto-generate-post/index.ts` — replace IMAGE PROMPT RULES block with agent-matching rules

