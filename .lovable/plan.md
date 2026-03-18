

## Plan: Show Event Historical Info on Click

### What to Do
When a user clicks on an event row in the Event Calendar, expand/toggle a detail panel below it showing:
- The full date (e.g., "March 20, 2026")
- A short historical description of what the event is and why it matters

### Changes

**1. Add historical descriptions to `src/data/contentStrategyData.ts` (and `supabase/functions/_shared/eventCalendar.ts`)**
Add a `history` field to the `CalendarEvent` interface and populate it for each event. E.g.:
- Nowruz: "Nowruz marks the Persian New Year, celebrated for over 3,000 years. It falls on the spring equinox and symbolizes renewal and new beginnings across Iranian, Kurdish, and Central Asian cultures."
- International Women's Day: "Celebrated since 1911, IWD honors women's social, economic, cultural, and political achievements worldwide."

**2. Update `EventCalendarSection` in `src/pages/AgentWorkspace.tsx`**
- Add `expandedEvent` state to track which event is expanded
- Make the event row clickable (toggle expand)
- When expanded, show a small panel below the row with:
  - Full formatted date: "March 20, 2026"
  - Historical description text
  - Subtle styling (bg-muted/50, smaller text)

### Files to Change
1. `src/data/contentStrategyData.ts` — add `history` field to interface + all events
2. `supabase/functions/_shared/eventCalendar.ts` — mirror the `history` field
3. `src/pages/AgentWorkspace.tsx` — add expand/collapse + display historical info

