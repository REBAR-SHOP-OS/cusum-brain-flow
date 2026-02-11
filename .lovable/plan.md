

## Give Vizzy Knowledge of Team Clock-In/Clock-Out Activity

### Problem
Vizzy only knows about agent chat sessions. Vicky Anderson doesn't use AI agents, so Vizzy says "I don't know what she did." But Vicky IS clocked in right now -- Vizzy just can't see time clock data.

### Changes

**1. Update `src/hooks/useVizzyContext.ts`**
- Add `teamPresence` field to `VizzyBusinessSnapshot`:
  ```
  teamPresence: { name: string; clocked_in: string; clocked_out: string | null }[]
  ```
- Add a query for today's `time_clock_entries` joined with `profiles` (via `profile_id`) to get who clocked in/out and when

**2. Update `src/lib/vizzyContext.ts`**
- Add a "TEAM PRESENCE (TIME CLOCK)" section to the system prompt showing:
  - Who is currently clocked in (clock_out IS NULL) with their clock-in time
  - Who clocked out already today with their hours
- Example:
  ```
  👷 TEAM PRESENCE (TIME CLOCK)
  Currently On:
    * Vicky Anderson — clocked in at 10:17 AM
    * Kourosh Zand — clocked in at 8:30 AM
  Clocked Out Today:
    * Ben Rajabifar — 7:00 AM to 3:30 PM (8.5 hrs)
  ```

### Result
When the CEO asks "what did Vicky do today?", Vizzy can at least say "Vicky Anderson clocked in at 10:17 AM and is currently working." If she also used agents, that info appears in the Agent Activity section too.

### Technical Notes
- No schema changes -- uses existing `time_clock_entries` table (joins on `profile_id` to `profiles.id`)
- Added as one more parallel query in the existing `Promise.all` block
- Only fetches today's entries to keep it lightweight
