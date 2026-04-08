

# Grant Full Access to sattar@rebar.shop

## Problem
`sattar@rebar.shop` (the CEO and most important Super Admin) has an explicit menu list instead of `fullAccess: true`, meaning new menus added in the future won't automatically appear for him. He should have the same unrestricted access as `radin@rebar.shop`.

## Changes

### `src/lib/userAccessConfig.ts` (lines 49–65)

Add `fullAccess: true` and set `agents: []` (resolved to ALL via fullAccess), matching the pattern used by `radin@rebar.shop`:

```tsx
"sattar@rebar.shop": {
  fullAccess: true,
  menus: [],
  agents: [],
  primaryAgent: "assistant",
  heroText: "How can your **CEO Portal** help you today?",
  quickActions: [ /* keep existing 4 quick actions unchanged */ ],
},
```

This ensures `getVisibleMenus` and `getVisibleAgents` both return ALL items for Sattar, just like Radin.

| File | Change |
|------|--------|
| `src/lib/userAccessConfig.ts` | Add `fullAccess: true`, clear explicit `menus`/`agents` arrays |

