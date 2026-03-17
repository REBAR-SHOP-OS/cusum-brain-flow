

# Make Pixel Agent Behave Like a Real LLM for Image Generation

## Problem
The Pixel agent currently follows a rigid slot-based workflow: show schedule → user picks slot → generate image. When a user types a free-text creation request like "برای نوروز یک عکس بساز" (make a Nowruz image), the agent should immediately generate and display the image based on the selected aspect ratio, but the deterministic guardrails and prompt wording push toward the slot workflow.

The system *technically* supports free-text creation (the `socialForceTools` logic + `generate_image` tool exist), but:
1. The schedule guardrail on new chats can intercept before the LLM sees the message
2. The system prompt says "Your ONLY job: generate images/videos when given a **slot selection**" — narrowing the agent's self-concept
3. The creation intent regex may miss some natural language requests

## Changes

### 1. `supabase/functions/ai-agent/index.ts` — Widen creation intent detection
- Expand `isCreationIntent` regex to catch more natural Persian/English creation phrases: "بنر", "طراحی", "ساخت", "poster", "banner", "logo intro", "content", "پوستر"
- Make the schedule guardrail **only** trigger when there is clearly NO creation intent AND the user explicitly asks for a schedule or it's an empty new-chat auto-message
- Ensure that when `isCreationIntent` is true on a new chat, the request flows through to the LLM with `toolChoice: "required"`

### 2. `supabase/functions/_shared/agents/marketing.ts` — Update Pixel system prompt
- Remove the restrictive line "Your ONLY job: generate images/videos + captions when given a slot selection"
- Add a clear instruction: "You are a creative LLM. When the user asks you to create ANY image on ANY topic, you MUST immediately call `generate_image` with a detailed prompt matching their request and the selected aspect ratio."
- Reinforce that the slot workflow is optional — users can also just describe what they want in free text
- Add instruction to always respect the `imageAspectRatio` from context when generating

### 3. Redeploy `ai-agent` edge function

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Widen `isCreationIntent` regex; tighten schedule guardrail to only fire on explicit schedule requests or auto-messages |
| `supabase/functions/_shared/agents/marketing.ts` | Update Pixel prompt to act as a true creative LLM, not just a slot-based generator |

