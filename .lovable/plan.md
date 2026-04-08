

# Ben's Access: Menu Items + Dashboard Agent Restriction

## Summary
Update ben@rebar.shop to have access to: **Inbox, Team Hub, Pipeline, Time Clock, Dashboard** (menu items), with the Dashboard showing **only** Blitz, Haven, Gauge, and Eisenhower agents — nothing else (no Workspaces, no Automations, no Daily Briefing).

## Changes

### 1. `src/lib/userAccessConfig.ts` — Update ben's config (lines 125–136)

```typescript
"ben@rebar.shop": {
  menus: ["Dashboard", "Inbox", "Team Hub", "Pipeline", "Time Clock"],
  agents: ["sales", "support", "estimating", "eisenhower"],
  primaryAgent: "sales",
  heroText: "How can **Blitz** help you today?",
  quickActions: [
    { title: "Pipeline overview", prompt: "Give me a pipeline summary — active leads, expected close dates, and any deals that need attention.", icon: "TrendingUp", category: "Sales" },
    { title: "Customer inquiry", prompt: "Show me recent customer inquiries and support tickets that need attention.", icon: "HeadphonesIcon", category: "Customer Care" },
    { title: "Open takeoffs", prompt: "Show me all open takeoff sessions and their status — pending reviews, QC flags, and deadlines.", icon: "FileText", category: "Estimating" },
    { title: "Prioritize my tasks", prompt: "Help me organize my tasks using the Eisenhower Matrix — what's urgent vs important right now?", icon: "LayoutGrid", category: "Eisenhower" },
  ],
},
```

### 2. `src/pages/Home.tsx` — Hide Workspaces & Automations for ben

Currently the Home page shows for all non-workshop users:
- Hero + ChatInput
- Daily Briefing (super admin only) ✓ already hidden
- Agent Suggestions
- **Workspaces section** (CEO Portal, Time Clock, Team Hub, Transcribe)
- **Automations section**
- **Helpers section** (agent cards)

For ben, the dashboard should show **only** the agent helpers (Blitz, Haven, Gauge, Eisenhower). Hide Workspaces and Automations sections when user is ben@rebar.shop.

Add a check around the Workspaces and Automations sections (~lines 278–307):

```typescript
const isBenRestricted = user?.email?.toLowerCase() === "ben@rebar.shop";
```

Then wrap both sections with `{!isBenRestricted && ( ... )}`.

### 3. RoleGuard — Ben is internal (@rebar.shop)

Ben has roles in the system. His current roles allow him through RoleGuard for the routes matching his menus (Inbox → `/inbox-manager`, Team Hub → `/team-hub`, Pipeline → `/pipeline`, Time Clock → `/timeclock`, Home → `/home`). No RoleGuard changes needed — the menu visibility in `userAccessConfig.ts` controls what he sees in sidebar/nav.

| File | Change |
|------|--------|
| `src/lib/userAccessConfig.ts` | Update ben's menus to Dashboard, Inbox, Team Hub, Pipeline, Time Clock; agents to sales, support, estimating, eisenhower |
| `src/pages/Home.tsx` | Hide Workspaces and Automations sections for ben |

