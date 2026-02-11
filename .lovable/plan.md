

## Give Vizzy Visibility Into Today's Agent Activity

### Problem
Vizzy doesn't know what agents (Gauge, Blitz, Penny, etc.) did today because the `chat_sessions` and `chat_messages` tables are not queried as part of her business snapshot.

### Changes

**1. Update `src/hooks/useVizzyContext.ts`**
- Add a new field `agentActivity` to `VizzyBusinessSnapshot`:
  ```
  agentActivity: { agent_name: string; session_count: number; last_topic: string; user_email: string }[]
  ```
- Add a new query alongside the existing parallel fetches that pulls today's `chat_sessions` joined with `profiles` (to get user name/email) and the latest message content per session
- Query: select today's sessions grouped by `agent_name`, with session count and the title of the most recent session per agent+user combo

**2. Update `src/lib/vizzyContext.ts`**
- Add a new "AGENT ACTIVITY TODAY" section to the system prompt, listing which agents were used, by whom, how many sessions, and what was discussed (session titles)
- Example output in prompt:
  ```
  🤖 AGENT ACTIVITY TODAY
    - Gauge (Estimation): 1 session by Ben — "Estimating briefing"
    - Vizzy (CEO Assistant): 5 sessions by Sattar — latest: "hi"
  ```

### Result
Vizzy will be able to answer questions like "what did Vicky do today?", "who used which agents?", "did Ben check his estimates?" by referencing actual chat session logs from the current day.

### Technical Notes
- No schema changes needed -- uses existing `chat_sessions` and `profiles` tables
- Added as one more parallel Promise in the existing `Promise.all` block
- Only fetches today's sessions to keep payload small

