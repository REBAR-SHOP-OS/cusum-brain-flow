

# Show Assigned Agents per User with Activity Reports

## Problem
The Agents section under each user currently only shows agents they've **used** (from `chat_sessions`). If a user hasn't used their assigned agent yet, nothing appears. The user wants to see which agents are **available/assigned** to each user, and show activity reports only if they've actually used them.

## Data Source
`src/lib/userAgentMap.ts` already maps each `@rebar.shop` email to their primary agent (e.g., Saurabh → `sales`/Blitz, Zahra → `social`/Pixel). `src/components/agent/agentConfigs.ts` has agent display names and roles.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx` — `UserAgentsSections` component (~line 181)

1. Accept `email` prop in addition to `userId` and `name`
2. Import `getUserAgentMapping` from `@/lib/userAgentMap` and `agentConfigs` from `@/components/agent/agentConfigs`
3. Look up the user's assigned agent via `getUserAgentMapping(email)`
4. Merge assigned agent(s) with actual session data:
   - If the assigned agent has session data → show it with full activity report (sessions, messages, recent thread)
   - If the assigned agent has **no** session data → show it with a "No activity yet" indicator
   - Also show any other agents the user has used beyond their assigned one
5. Pass `email` from the parent where `UserAgentsSections` is rendered (~line 482-485), using `selectedProfile.email`

### Result
- Each user sees their assigned agent listed (e.g., Saurabh sees "Blitz — Sales & Pipeline")
- If they've used it, the activity report expands with sessions/messages
- If they haven't, it shows the agent name with "No activity yet"
- Any additional agents they've used also appear with reports

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — update `UserAgentsSections` to show assigned agents + pass email prop

