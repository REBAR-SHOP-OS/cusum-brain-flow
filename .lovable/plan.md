

## Fix "New Chat" Reset for Purchasing Agent

### Problem
When "New Chat" is clicked, the purchasing list still shows all items (including purchased ones with green checkmarks) because the data reflects actual DB state. The user expects a clean, fresh view.

### Solution
Two changes:

**1. `src/pages/AgentWorkspace.tsx` — `handleNewChat`**
- Set `purchasingDate` to `undefined` and `activePurchasingDateStr` to `null` instead of today's date
- This shows a fresh "no date" view — items without a due date (i.e., newly added, unconfirmed items)
- Keep the `purchasingKey` increment for full remount

**2. `src/components/purchasing/PurchasingListPanel.tsx`**
- Add an optional `defaultFilterStatus` prop (default: `"all"`)
- Initialize `filterStatus` state from this prop
- In `AgentWorkspace.tsx`, pass `defaultFilterStatus="pending"` so that after "New Chat", the panel defaults to showing only un-purchased items

### Files

| File | Change |
|---|---|
| `src/pages/AgentWorkspace.tsx` | Reset date to `undefined`/`null` on new chat; pass `defaultFilterStatus="pending"` |
| `src/components/purchasing/PurchasingListPanel.tsx` | Accept `defaultFilterStatus` prop, use it as initial state |

