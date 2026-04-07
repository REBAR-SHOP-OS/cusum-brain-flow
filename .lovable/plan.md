

# Remove All Agent Access for Kourosh

## Problem
`kourosh@rebar.shop` (role: `shop_supervisor`) currently has access to 5 agents via the `shop_supervisor` role: shopfloor, delivery, assistant, eisenhower, growth. He should have access to **no agents at all**.

## Changes

### 1. `src/components/vizzy/VizzyBrainPanel.tsx`
Set the `shop_supervisor` role to an empty array:
```typescript
shop_supervisor: [],
```

### 2. `src/lib/userAgentMap.ts`
Remove or empty out Kourosh's entry (lines 22–33) — set `quickActions` to an empty array and keep the mapping minimal so the system doesn't break:
```typescript
"kourosh@rebar.shop": {
  agentKey: "shopfloor",
  userRole: "shop_supervisor",
  heroText: "Welcome, Kourosh",
  quickActions: [],
},
```

Two files, minimal changes. No database changes.

