

# Show Only Used Agents in Monitoring View

## Problem
The Agents section currently shows all 22 agents from `agentConfigs`, including ones the user has never used. This is a **monitoring** panel — its purpose is to report which agents a user has actually interacted with. Showing unused agents (all with "0 sessions") adds noise and defeats the purpose.

## Rule
**Only display agents that the selected user has at least 1 session with.** If a user has never used an agent, it should not appear in the list.

## Changes

### File: `src/hooks/useUserAgentSessions.ts`

Remove the logic that adds all `agentConfigs` agents to the result set. Only iterate over agents found in the user's `chat_sessions` data.

Specifically:
1. **Remove lines 44-53** — the `allAgentNames` set that merges all config names
2. **Remove the `else` branch (lines 83-92)** — the block that adds agents with 0 sessions
3. **Iterate only over `agentMap.keys()`** — agents the user actually has sessions with
4. Sort by `lastUsed` descending (no inactive agents to sort)

Result: If Neel has only used Blitz and Vizzy, only those two appear. No "0 sessions" clutter.

## Files Changed
- `src/hooks/useUserAgentSessions.ts` — filter to only agents with real session data

