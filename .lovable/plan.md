

## Plan: Prevent Event/Occasion Content in Recipe Slot Generation

### Problem
When a user clicks "Generate" on a recipe time slot (e.g., 06:30 Stirrups), the `generateDynamicContent` function asks the AI to be creative with "seasonal relevance" as one of the suggested angles. This causes the AI to inject occasion/holiday content (like Nowruz, St. Patrick's Day) into recipe slot captions and images — even though events have their own separate "Generate" button in the Event Calendar section.

### Root Cause
In `supabase/functions/ai-agent/index.ts`, line ~104 in the `generateDynamicContent` prompt:
```
"Use a unique creative angle each time: humor, statistics, metaphors, customer benefits, industry facts, seasonal relevance, etc."
```
The phrase "seasonal relevance" encourages the AI to theme content around holidays/events.

### Fix
**File: `supabase/functions/ai-agent/index.ts`** — In the `generateDynamicContent` function prompt (~line 104):

1. Remove "seasonal relevance" from the creative angle suggestions
2. Add an explicit prohibition: `"Do NOT reference any holidays, cultural events, occasions, or seasonal celebrations. Focus ONLY on the product and its construction/industrial benefits."`

This ensures recipe slots stay product-focused, while the Event Calendar "Generate" button (which sends a completely different message like "Generate a post for Nowruz") will naturally include occasion content via the LLM conversation path.

### Files to Change
1. `supabase/functions/ai-agent/index.ts` — modify `generateDynamicContent` prompt to forbid event/occasion references

