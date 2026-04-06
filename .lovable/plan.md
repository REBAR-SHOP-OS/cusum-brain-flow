

# Show All Available Agents Per User (Not Just Active Sessions)

## Problem
The Agents section only shows agents that have `chat_sessions` records. If a user has access to agents like Pixel, Seomi, Blitz but hasn't chatted with them yet, they don't appear. The user wants to see **all agents accessible to the user**, with session counts (including 0).

## Solution
Combine two data sources:
1. **All agents from `agentConfigs`** (the full agent catalog — ~22 agents)
2. **Actual session data from `chat_sessions`** for the selected user

Show every agent the user could use, with real session stats where available, and "(0)" for unused ones.

## Changes

### File: `src/hooks/useUserAgentSessions.ts`

1. Import `agentConfigs` from `@/components/agent/agentConfigs`
2. After fetching `chat_sessions` data, build a complete list from all `agentConfigs` keys
3. For each agent in configs:
   - If sessions exist → show real stats (session count, messages, recent messages)
   - If no sessions → show with `sessionCount: 0, totalMessages: 0, recentMessages: []`
4. Match `chat_sessions.agent_name` to `agentConfigs` keys by normalizing (lowercase comparison, or matching config `name` field)
5. Sort: agents with activity first (by last used), then inactive agents alphabetically

### Matching Logic
The `chat_sessions.agent_name` stores values like "Vizzy", "Architect", "Seomi", "Eisenhower Matrix". These correspond to the `name` field in `agentConfigs` (e.g., `agentConfigs.assistant.name = "Vizzy"`, `agentConfigs.empire.name = "Architect"`). Match by name to merge the data.

## Files Changed
- `src/hooks/useUserAgentSessions.ts` — merge agentConfigs with session data to show complete agent list

