

# Fix: Vizzy Brain Agent & Menu Overrides Not Enforced

## Problem

When you assign/remove agents or items (menus) for a user in Vizzy Brain, the data **is saved** to the `user_access_overrides` table in the database. However, the actual UI components that control what users see **don't read those overrides** for agents — they only read the hardcoded config in `userAccessConfig.ts`.

### What works
- **Menus (Items)**: `AppSidebar.tsx` correctly reads from `user_access_overrides` and falls back to hardcoded config. Saving menus in Vizzy Brain **does work end-to-end**. ✅

### What's broken
- **Agents**: `Home.tsx`, `LiveChatWidget.tsx`, and anywhere else calling `getVisibleAgents()` only reads from the hardcoded `USER_ACCESS` map — **DB overrides are completely ignored**. ❌

## Fix

### 1. `src/pages/Home.tsx` — Read agent overrides from DB

Add `useUserAccessOverrides` hook and prefer DB agents over hardcoded config:

```typescript
const { override } = useUserAccessOverrides(user?.email);
const allowedAgents = override?.agents?.length 
  ? override.agents 
  : getVisibleAgents(user?.email);
```

### 2. `src/components/layout/LiveChatWidget.tsx` — Same pattern

Read overrides and use them to determine agent visibility:

```typescript
const { override } = useUserAccessOverrides(user?.email);
const visibleAgents = override?.agents?.length 
  ? override.agents 
  : getVisibleAgents(user?.email);
if (visibleAgents.length === 0) return null;
```

### 3. Any other consumer of `getVisibleAgents`

Search and patch all call sites to prefer DB overrides. This includes `hasAgentAccess()` calls used in agent chat routing.

## Result

After this fix, when you toggle an agent on/off for a user in Vizzy Brain, it will immediately affect what that user sees on their Home page and chat widget.

## Files to Edit
| File | Change |
|------|--------|
| `src/pages/Home.tsx` | Add override hook, use DB agents |
| `src/components/layout/LiveChatWidget.tsx` | Add override hook, use DB agents |
| Any other `getVisibleAgents` / `hasAgentAccess` consumers | Same pattern |

## No backend/schema changes needed

