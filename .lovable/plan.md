

# Fix: Calendar Date Selection + Show Date Lists in RECENTS Sidebar

## Problem
The calendar date picker works but selecting a date doesn't create a visible entry in the RECENTS sidebar. The sidebar currently shows empty chat sessions. All purchasing items have `null` due_date.

## Solution
Repurpose the RECENTS sidebar for the purchasing agent to show **distinct dates** that have purchasing list items. Lift the `filterDate` state from `PurchasingListPanel` up to `AgentWorkspace` so both the sidebar and the panel share it.

## Changes

### 1. `src/hooks/usePurchasingDates.ts` — New hook
- Query distinct `due_date` values from `purchasing_list_items` for the user's company
- Return a sorted list of dates (excluding null) to display in the sidebar RECENTS
- Subscribe to realtime changes to auto-refresh

### 2. `src/components/purchasing/PurchasingListPanel.tsx`
- Accept `filterDate` and `onFilterDateChange` as props (lift state up)
- Remove internal `filterDate` state — use props instead
- When adding an item with the calendar date selected, the item gets that `due_date`

### 3. `src/pages/AgentWorkspace.tsx`
- Add `purchasingDate` state at the workspace level
- Pass it down to `PurchasingListPanel` as a prop
- For the purchasing agent's sidebar: instead of showing empty chat sessions in RECENTS, show distinct dates from `usePurchasingDates`
- Clicking a date in RECENTS sets `purchasingDate`, filtering the list
- "New chat" button resets date filter (shows all items)

### 4. `src/components/agent/AgentHistorySidebar.tsx`
- Add optional `purchasingDates` and `onSelectDate` props
- When `purchasingDates` is provided (purchasing agent), render date entries in RECENTS instead of chat sessions
- Each entry shows the formatted date; clicking it triggers `onSelectDate`
- Active date is highlighted like an active session

## Flow
1. User opens Kala (purchasing agent)
2. Sidebar RECENTS shows dates that have items (e.g., "2026-03-18")
3. User clicks calendar → selects a date → list filters to that date
4. That date also appears highlighted in RECENTS
5. User adds items with the date selected → items get that `due_date`
6. The date appears in RECENTS automatically via realtime

