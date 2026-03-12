

# Inject Event Calendar into Content Generation

## Problem
The auto-generate function and Pixel agent currently ignore the Monthly Event Calendar. Posts should reference upcoming events/occasions when they're suitable for advertising.

## Approach
Embed the event calendar data directly in the edge functions (since it's static data defined in `contentStrategyData.ts` which is a frontend file). Add a helper that returns upcoming events for the target date, filtered for advertising suitability, and inject them into the AI prompts.

## Changes

### 1. Create shared event helper (`supabase/functions/_shared/eventCalendar.ts`)
- Copy the `yearlyEvents` array data from `contentStrategyData.ts` into a backend-accessible module
- Add `getUpcomingEvents(date, days=7)` function that returns events within N days of the target date
- Add `isAdvertisable(event)` filter — exclude somber/non-promotional events like "National Day of Mourning", "Day for Truth & Reconciliation", "World Mental Health Day" (keep a skip-list of event names unsuitable for ads)

### 2. Update `supabase/functions/auto-generate-post/index.ts`
- Import the event helper
- Before building the system prompt, call `getUpcomingEvents(postDate, 3)` to find events within 3 days
- If events exist, inject an `## UPCOMING EVENTS` section into the system prompt instructing the AI to:
  - Theme 1-2 of the 5 posts around the event
  - Use the event's `contentTheme` and `hashtags`
  - Keep the promotional angle — tie the event to Rebar.shop products/services
  - Only use events that naturally support advertising

### 3. Update `supabase/functions/_shared/agents/marketing.ts` (Pixel agent prompt)
- Add a dynamic event injection point in the prompt
- The Pixel agent prompt is static, so we'll add instructions telling Pixel to check for events via a new section

### 4. Update `supabase/functions/ai-agent/index.ts` or `agentContext.ts`
- When the agent is "social" (Pixel), compute upcoming events and inject them into the context passed to the agent
- This way Pixel knows about current events when generating images/captions

## Non-advertisable events (skip list)
Events that should NOT be used for promotional content:
- National Day of Mourning
- National Day for Truth & Reconciliation  
- World Mental Health Day
- National Indigenous Peoples Day (respectful, not promotional)

## Prompt injection example
```
## UPCOMING EVENTS (use these for themed content!)
- Mar 17: St. Patrick's Day — Theme: "Lucky to have the best team, green builds" — Hashtags: #StPatricksDay #LuckyTeam
- Mar 20: First Day of Spring — Theme: "Construction season kickoff, spring projects" — Hashtags: #SpringIsHere #ConstructionSeason

INSTRUCTIONS: Incorporate these events into 1-2 posts. Tie the event theme to Rebar.shop products. Keep it promotional and celebratory.
```

## Files
- **New**: `supabase/functions/_shared/eventCalendar.ts`
- **Edit**: `supabase/functions/auto-generate-post/index.ts` — import events, inject into prompt
- **Edit**: `supabase/functions/_shared/agents/marketing.ts` — add event awareness instructions
- **Edit**: `supabase/functions/_shared/agentContext.ts` — inject upcoming events for social agent

