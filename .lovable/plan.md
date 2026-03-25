

## Remove Status Filter Tabs (All / Purchased)

### What Changes

**File: `src/components/purchasing/PurchasingListPanel.tsx`**

1. Remove the `STATUS_TABS` constant entirely
2. Remove the entire status tabs UI block (lines 124–136)
3. Hardcode `filterStatus` to always be `"all"` — remove the state, remove the `defaultFilterStatus` prop
4. Clean up the `PurchasingListPanelProps` interface (remove `defaultFilterStatus`)

**File: `src/pages/AgentWorkspace.tsx`**
- Remove any `defaultFilterStatus` prop passed to `PurchasingListPanel`

### Result
- No filter tabs shown at all — all items always visible
- Simpler UI with just the item list
- "New Chat" reset continues to work as before

