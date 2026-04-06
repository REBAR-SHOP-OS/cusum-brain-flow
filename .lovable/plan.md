

# Fix Agent Sessions: Show All Agents User Has Interacted With

## Problem
The `useUserAgentSessions` hook only queries agents from the `user_agents` table. Radin only has "Vizzy" assigned there, but has actually used 6 different agents (Vizzy, Architect, Eisenhower, Ike, Seomi, etc.) via `chat_sessions`. The current logic filters out all unassigned agents, so nothing meaningful shows up.

## Solution
Change the hook to discover agents from **actual `chat_sessions`** for the user, not just from `user_agents` assignments. This shows every agent the user has interacted with.

## Changes

### File: `src/hooks/useUserAgentSessions.ts`

Replace the current approach:
1. **Remove** the `user_agents` lookup entirely
2. **Query** `chat_sessions` directly for the user, grouped by `agent_name`
3. For each distinct `agent_name`, fetch session count, total messages, and recent messages (same as now)
4. Include all agents found — no filtering by `user_agents`

**Logic flow:**
```text
1. SELECT DISTINCT agent_name FROM chat_sessions WHERE user_id = X
2. For each agent_name → count sessions, count messages, fetch 10 recent messages
3. Sort by last active (descending)
```

This removes the dependency on `user_agents` and shows the real picture of what agents each user has actually used.

## Files Changed
- `src/hooks/useUserAgentSessions.ts` — rewrite query logic to source from `chat_sessions` instead of `user_agents`

