

# Add "Confirm & Save" Button + Reset on New Chat

## Problem
Currently the "Confirm" button only shows a toast. There's no mechanism to finalize/snapshot the current list by date and have it appear in RECENTS. When "New Chat" is clicked, the purchasing date filter should reset so the user sees the fresh default list.

## Changes

### 1. `PurchasingListPanel.tsx` — Make Confirm button functional
- The confirm button currently only shows a toast (line 235). Change it to:
  1. Set today's date as `due_date` on all items that don't have one yet (so they're tied to a date)
  2. If no `filterDate` is selected, auto-set it to today before confirming
  3. Call a new `confirmList` function that bulk-updates all current session items to have the selected date as `due_date`
  4. Show the confirm button **always** (remove the `filterDate && items.some(...)` condition) — the user should be able to confirm at any time
  5. After confirming, the date appears in RECENTS sidebar automatically (since `usePurchasingDates` already listens to realtime changes)

### 2. `usePurchasingList.ts` — Add `confirmList` function
- New function: `confirmList(date: string)` — updates all items for the current company that have `due_date IS NULL` (or match the current session) to set `due_date = date`
- This ensures the snapshot is tied to a specific date and shows up in `usePurchasingDates`

### 3. `AgentWorkspace.tsx` — Reset purchasing state on New Chat
- In `handleNewChat`, when `agentId === "purchasing"`:
  - Reset `purchasingDate` to `undefined`
  - Reset `activePurchasingDateStr` to `null`
- This makes the panel show the full default list again (no date filter = all items)

### 4. `PurchasingListPanel.tsx` — Auto-select today if no date on confirm
- When user clicks Confirm without a date selected, auto-set `filterDate` to today's date, then save all pending items with that date

## Flow
```text
User opens Purchasing → sees default list (no date filter)
→ marks items as purchased/rejected
→ clicks Confirm ✓
→ if no date selected, today's date is used
→ all unmarked items get due_date = today
→ date appears in RECENTS sidebar
→ clicks "New Chat"
→ date filter resets to none
→ sees fresh default list again
```

## Files
- `src/pages/AgentWorkspace.tsx` — reset purchasing state in `handleNewChat`
- `src/components/purchasing/PurchasingListPanel.tsx` — always show confirm, auto-date logic
- `src/hooks/usePurchasingList.ts` — add `confirmList` function

