

## Plan — Restrict kourosh@rebar.shop to 3 menus only

### Change
Update `src/lib/userAccessConfig.ts` (lines 155–159) — keep menus minimal but add Forge agent + floor-focused quick actions.

```ts
"kourosh@rebar.shop": {
  menus: ["Shop Floor", "Time Clock", "Team Hub"],
  agents: ["shopfloor", "talent"],
  primaryAgent: "shopfloor",
  heroText: "How can **Forge** help you run the floor today?",
  quickActions: [
    { title: "Floor status now", prompt: "Give me a full shop floor status — machines running, current operators, queue depth, and any blockers.", icon: "Factory", category: "Production" },
    { title: "Today's production", prompt: "Show me today's production output — bars cut, weight produced, completion rate vs plan.", icon: "TrendingUp", category: "Production" },
    { title: "Team on the floor", prompt: "Who is clocked in on the shop floor right now and what are they assigned to?", icon: "Users", category: "Team" },
    { title: "Inventory check", prompt: "Show stock levels for every rebar size and flag anything below reorder point.", icon: "Package", category: "Inventory" },
  ],
},
```

### Result
| Area | Value |
|---|---|
| Sidebar menus | Shop Floor, Time Clock, Team Hub (3 only) |
| Primary AI agent | Forge (shopfloor) |
| Secondary AI agent | Talent |
| Hero quick actions | 4 floor-focused prompts |

### Files touched
1. `src/lib/userAccessConfig.ts` — replace lines 155–159.

No DB, no RoleGuard, no edge function changes.

