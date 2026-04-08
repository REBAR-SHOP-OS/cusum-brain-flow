

# Update Vicky's Access: Agents & Menu Items

## Problem
Vicky currently has agents `["talent", "bizdev", "eisenhower", "accounting", "rebuild"]` and menus that include "Architecture" but miss "Inbox". The user wants:

**Agents:** Penny (accounting, primary), Eisenhower (eisenhower), Prism (data), Relay (email)
**Menus:** Dashboard, Accounting, Customers, Business Tasks, Team Hub, Settings, Inbox

## Changes

### `src/lib/userAccessConfig.ts` (lines 108–119)

```typescript
"vicky@rebar.shop": {
  menus: ["Dashboard", "Inbox", "Accounting", "Customers", "Business Tasks", "Team Hub", "Settings"],
  agents: ["accounting", "eisenhower", "data", "email"],
  primaryAgent: "accounting",
  heroText: "How can **Penny** help you today?",
  quickActions: [ /* keep existing 4 quick actions unchanged */ ],
},
```

| Change | Before | After |
|--------|--------|-------|
| `agents` | `["talent", "bizdev", "eisenhower", "accounting", "rebuild"]` | `["accounting", "eisenhower", "data", "email"]` |
| `menus` | `["Dashboard", "Team Hub", "Business Tasks", "Customers", "Accounting", "Architecture", "Settings"]` | `["Dashboard", "Inbox", "Accounting", "Customers", "Business Tasks", "Team Hub", "Settings"]` |

Removed: talent, bizdev, rebuild, Architecture. Added: data (Prism), email (Relay), Inbox.

| File | Change |
|------|--------|
| `src/lib/userAccessConfig.ts` | Update Vicky's `menus` and `agents` arrays |

