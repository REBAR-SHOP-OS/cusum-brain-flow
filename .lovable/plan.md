
# Fix: Restrict Penny (Accounting Agent) Access by Role

## Problem
The `/agent/accounting` route (Penny agent chat) has **no role-based access control**. Any authenticated user can navigate to it and interact with Penny, who has access to sensitive QuickBooks financial data (invoices, P&L, balance sheets, etc.).

Ben (sales + office roles) should NOT be able to chat with Penny. Only users with `admin` or `accounting` roles should have access.

The `/accounting` workspace page already enforces this correctly, but the agent chat route (`/agent/:agentId`) does not.

## Who Should Access Penny
- **Sattar** (admin) -- YES
- **Neel** (admin) -- YES
- **Vicky** (admin + accounting) -- YES
- **Ben** (sales + office) -- NO

## Root Cause
`AgentWorkspace.tsx` only blocks access for the `assistant` agent (Vizzy, super-admin only). No other agent has role restrictions.

## Plan

### Change 1: Add agent-to-role mapping in `AgentWorkspace.tsx`

Define a mapping of agent IDs to required roles. When a user navigates to a restricted agent, check their roles and redirect to `/home` if unauthorized.

```
Agent-Role Requirements:
- "accounting" (Penny) -> requires admin OR accounting
- "assistant" (Vizzy) -> requires super admin (already implemented)
- All other agents -> no restriction (accessible to all authenticated users)
```

**Implementation:**
1. Import `useUserRole` in `AgentWorkspace.tsx`
2. Define a `RESTRICTED_AGENTS` map: `{ accounting: ["admin", "accounting"] }`
3. Add a `useEffect` that checks if the current `agentId` is in the restricted map, and if the user lacks the required role, redirects to `/home`
4. Show the existing "Access Restricted" card (similar to AccountingWorkspace) while role loading is in progress

### Change 2: Hide Penny from agent suggestions on Home page

In `src/pages/Home.tsx`, filter the agent cards so users without `admin`/`accounting` roles don't see Penny listed as an available agent.

### Change 3: Hide Penny from navigation menus

In `src/components/layout/MobileNavV2.tsx` (and any sidebar/nav that links to `/agent/accounting`), ensure the Penny link is only visible to users with the correct roles.

---

## Technical Details

**File: `src/pages/AgentWorkspace.tsx`**
- Add after line 34 (`useSuperAdmin`):
```typescript
const { isAdmin, hasRole, isLoading: rolesLoading } = useUserRole();
```
- Add restricted agent config:
```typescript
const RESTRICTED_AGENTS: Record<string, AppRole[]> = {
  accounting: ["admin", "accounting"],
};
```
- Add useEffect to enforce access:
```typescript
useEffect(() => {
  if (rolesLoading) return;
  const required = RESTRICTED_AGENTS[agentId || ""];
  if (required && !required.some(r => hasRole(r))) {
    navigate("/home", { replace: true });
    toast.error("Access restricted");
  }
}, [agentId, rolesLoading]);
```
- Show loading state while roles are loading for restricted agents

**File: `src/pages/Home.tsx`**
- Filter agent cards based on role restrictions (hide Penny card for non-accounting users)

## What This Does NOT Change
- No database or RLS changes needed
- No edge function changes
- No changes to how Penny processes messages
- No changes to the `/accounting` workspace (already secured)
- Other agents remain accessible to all authenticated users

## Regression Prevention
- Route-level guard ensures even direct URL access is blocked
- Navigation filtering prevents accidental discovery
- Consistent with existing Vizzy super-admin pattern
