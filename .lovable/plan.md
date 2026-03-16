

# Fix: Pixel Agent Must Always Fulfill User Requests

## Problem
Two issues visible in the screenshot:
1. When user asks "create an image for Nowruz," the agent says it can't because Nowruz isn't in its event calendar. The agent should create content for **any** topic the user requests — the calendar is for auto-generation themes, not a restriction.
2. When 9:16 image generation fails, the agent gives up and suggests trying a different ratio instead of automatically retrying with a fallback.

## Changes

### 1. `supabase/functions/_shared/agents/marketing.ts` — Add "always fulfill" rule

Add to the CRITICAL BEHAVIOR section:
- "NEVER refuse a user request because an event or topic is not in your calendar. The calendar is for AUTO-generated content themes only. When a user explicitly asks for content about ANY topic (Nowruz, Diwali, Eid, any custom event, etc.), you MUST create it immediately using generate_image."
- "If image generation fails with one aspect ratio, automatically retry with 1:1 (square) as fallback. NEVER tell the user there's a problem with a specific ratio — just produce the image."

### 2. `supabase/functions/_shared/eventCalendar.ts` — Add Nowruz

Add Nowruz (March 20) to the yearly events list since it's culturally relevant to the business.

### 3. `supabase/functions/_shared/agentToolExecutor.ts` — Add fallback ratio retry

In the `generate_image` tool handler (around line 797), when all attempts fail AND the aspect ratio is not "1:1", add a second retry loop with ratio "1:1" before giving up. This ensures an image is always produced even if the model struggles with portrait/landscape ratios.

### Summary

| Change | Purpose |
|--------|---------|
| Marketing prompt update | Never refuse user requests; always create |
| Add Nowruz to calendar | Cultural relevance for the business |
| Fallback ratio retry | If 9:16 fails, retry with 1:1 instead of giving up |

