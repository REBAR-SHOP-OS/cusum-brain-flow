

# Improve Agent Report in Vizzy Brain User Dashboard

## Current State
The agent accordion already shows assigned agents from `user_agents` table. However, expanding an agent only shows 3 recent messages from the latest session — not a meaningful work report.

## Problem
- Only 3 messages from 1 session are shown — not enough for a real report
- No summary stats per agent (total sessions, total messages, last active time)
- The user wants to see a comprehensive report of how each user interacts with each agent

## Changes

### 1. `src/hooks/useUserAgentSessions.ts` — Fetch richer data
- Increase message limit from 3 to 10 for the expanded report
- Add `totalMessages` count per agent (query count from `chat_messages` for all sessions of that agent)
- Add `allSessionIds` so we can show messages across multiple sessions, not just the latest

### 2. `src/components/vizzy/VizzyBrainPanel.tsx` — Enhanced accordion content
- Show agent summary header when expanded: total sessions, total messages, last active date
- Show messages grouped by session date
- Display user messages vs agent responses clearly
- Show "No activity" for agents with 0 sessions instead of generic "No messages"

### Visual Structure
```text
▸ Vizzy (1 session)
  ┌─────────────────────────────────┐
  │ Sessions: 1  Messages: 5        │
  │ Last active: Apr 6, 3:01 PM     │
  ├─────────────────────────────────┤
  │ 👤 User: "How many people..."   │
  │ 🤖 Vizzy: "Currently 3 staff.." │
  │ 👤 User: "Who is absent?"       │
  │ 🤖 Vizzy: "Behnam and Neel..."  │
  └─────────────────────────────────┘

▸ Dashboard (0)
  ┌─────────────────────────────────┐
  │ No activity with this agent yet │
  └─────────────────────────────────┘
```

## Files Changed
- `src/hooks/useUserAgentSessions.ts`
- `src/components/vizzy/VizzyBrainPanel.tsx`

