

# Fix: Search Not Working in Kanban View

## Problem
The search filter only applies to the **list view**. When in **kanban view** (which appears to be your current view), the kanban board receives `allEmails` directly, completely ignoring the search state. So typing in the search box has no effect on what's displayed.

## Solution
Replace `allEmails` with the filtered `emails` array in the kanban view rendering, so the search filter applies in both views.

## Technical Changes

### File: `src/components/inbox/InboxView.tsx`

1. **Kanban board data (line ~884)**: Change the emails passed to `InboxKanbanBoard` from:
   ```
   allEmails.filter(e => !hiddenIds.has(e.id) && !snoozedUntil.has(e.id) && ...)
   ```
   to:
   ```
   emails.filter(e => kanbanTypeFilter === "all" || e.commType === kanbanTypeFilter)
   ```
   Since `emails` already filters out hidden/snoozed items AND applies the search query.

2. **Kanban type filter tab counts (lines ~859-862)**: Update the count calculations to use `emails` instead of `allEmails` so the tab counts reflect search results:
   - `"all"` count: `emails.length`
   - `"email"` count: `emails.filter(e => e.commType === "email").length`
   - `"call"` count: `emails.filter(e => e.commType === "call").length`
   - `"sms"` count: `emails.filter(e => e.commType === "sms").length`

This ensures the search box works consistently regardless of which view mode (list or kanban) is active.
