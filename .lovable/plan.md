

## Plan: Make Event-Themed Images Opt-In Only

### Problem
Currently, the event calendar is always injected into Pixel's brain with instructions like "Incorporate these events into 1-2 of your posts." This forces event-themed content even when the user just wants normal promotional images.

### Desired Behavior
- Default: All generated images are normal promotional/advertising style, based on user-selected style, product, and aspect ratio
- Event-themed: Only when the user explicitly mentions an event or occasion in their message

### Changes

**1. `supabase/functions/_shared/eventCalendar.ts`** — Change the prompt block text

Replace the current forceful instruction:
> "INSTRUCTIONS: Incorporate these events into 1-2 of your posts"

With a passive reference:
> "REFERENCE ONLY: These events are available IF the user explicitly asks for event-themed content. Do NOT use them unless the user mentions an event or occasion."

**2. `supabase/functions/_shared/agentContext.ts`** (line 228) — Keep event injection but as passive context

The event block stays in the brain (so the agent knows what events exist if asked), but the instruction tone changes from "you must use these" to "available on request only."

**3. `supabase/functions/_shared/agents/marketing.ts`** — Update Pixel agent prompt

Add a clear rule near the top:
> "DEFAULT MODE: All images are normal promotional/advertising content for REBAR.SHOP. Do NOT add event themes, holiday decorations, or occasion references unless the user EXPLICITLY asks for it (e.g., 'make a Nowruz post', 'add St. Patrick's Day theme'). User-selected style, product, and aspect ratio from the toolbar are your primary creative direction."

**4. `supabase/functions/auto-generate-post/index.ts`** (line 273-280) — Make event injection conditional

In recipe/auto-generate mode, only inject the event block if the user explicitly opted in (e.g., via a parameter). For now, remove the automatic injection so recipe-generated posts are purely promotional by default.

### Files to Change
1. `supabase/functions/_shared/eventCalendar.ts` — Soften instruction text
2. `supabase/functions/_shared/agentContext.ts` — Keep as passive reference
3. `supabase/functions/_shared/agents/marketing.ts` — Add "default = promotional" rule
4. `supabase/functions/auto-generate-post/index.ts` — Remove forced event injection

