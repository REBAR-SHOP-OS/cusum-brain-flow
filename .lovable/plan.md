

## Plan: Add Missing Nowruz Event + Enhance Historical Descriptions

### What I Found
- The event calendar data (`contentStrategyData.ts`) is **missing Nowruz** — it exists in the backend mirror (`eventCalendar.ts`) and has a Persian entry in `PERSIAN_EVENT_INFO`, but no corresponding event in the frontend data
- All other events already have English `description` + Persian `PERSIAN_EVENT_INFO` with historical context
- The popover UI already renders both English and Persian sections nicely

### Changes

**File: `src/components/social/contentStrategyData.ts`**
- Add Nowruz (March 20) event entry with full historical description: origin ~3000 years ago in ancient Persia, UNESCO Intangible Cultural Heritage, celebrated by 300M+ people across Iran, Afghanistan, Central Asia, Kurdistan, etc.
- It should be placed between St. Patrick's Day (Mar 17) and First Day of Spring (Mar 20)

**File: `src/components/social/ContentStrategyPanel.tsx`**
- The `PERSIAN_EVENT_INFO` already has a Nowruz entry — no change needed there

**File: `supabase/functions/_shared/eventCalendar.ts`**  
- Add the `description` field to the backend mirror's `CalendarEvent` interface and Nowruz entry (keep backend in sync)

This is a data-only change — one new event row in the frontend data file.

