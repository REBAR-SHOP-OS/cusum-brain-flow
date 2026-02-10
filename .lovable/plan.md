

## Add Personalized AI Agent for neel@rebar.shop

Neel is a designated administrator but currently has no entry in the user-agent mapping, so he gets the generic Home page experience. This adds Neel with Vizzy (CEO Assistant) as his primary agent.

### What Changes

**File: `src/lib/userAgentMap.ts`**

Add a new entry for `neel@rebar.shop` in the `userAgentMappings` object:

```typescript
"neel@rebar.shop": {
  agentKey: "assistant",
  userRole: "ceo",
  heroText: "How can your **CEO Command** help you today?",
  quickActions: [
    { title: "Business Health Score", prompt: "Give me the full business health score — production, revenue, AR, team attendance, and machine status. Highlight anything that needs my attention.", icon: "Activity", category: "Executive" },
    { title: "Today's exceptions", prompt: "Show me today's exceptions only — anything overdue, blocked, or flagged across all departments.", icon: "AlertTriangle", category: "Executive" },
    { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
    { title: "Team attendance", prompt: "Show me today's team attendance — who's clocked in, who's absent, and any patterns to watch.", icon: "Users", category: "HR" },
  ],
},
```

This gives Neel:
- **Vizzy** as his primary AI agent on the Home page
- **Personalized hero text**: "How can your CEO Command help you today?"
- **4 executive quick actions**: Business Health Score, Today's Exceptions, Pipeline Overview, Team Attendance
- Same configuration as Sattar since both are administrators with full system access

No other files need to change -- the Home page, agent workspace, and Daily Summarizer already read from `userAgentMap.ts` dynamically.

