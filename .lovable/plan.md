

## Plan: Reset Purchasing List to Today on New Chat

### Problem
When "New chat" is clicked in the Purchasing agent, `purchasingDate` is set to `undefined`, which causes the list to show ALL items across all dates instead of a fresh list.

### Fix

**File: `src/pages/AgentWorkspace.tsx`** (lines 152-162, `handleNewChat`)

Change the purchasing reset logic to set today's date instead of clearing it:

```typescript
if (agentId === "purchasing") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  setPurchasingDate(today);
  setActivePurchasingDateStr(today.toISOString().split("T")[0]);
}
```

This ensures clicking "New chat" shows today's purchasing list (which will be empty/fresh if no items have been added for today yet, or show today's defaults).

### File to Change
- `src/pages/AgentWorkspace.tsx` — one small change in `handleNewChat`

