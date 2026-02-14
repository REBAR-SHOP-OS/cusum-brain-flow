
# Add Action Buttons to Penny's Briefing List Items

## What Changes

Each bullet point in Penny's briefing response (Action Items for Today, Upcoming This Week, etc.) will get three small action buttons that appear on hover:

- **Ignore** -- Opens a small popover to enter a reason, then strikes through the item
- **Reschedule** -- Opens a date picker popover to pick a new date, then logs it
- **Summarize** -- Sends the item text to Penny as a follow-up question for a detailed summary

## How It Works

When Penny's AI response contains list items (bullet points), each one will show a row of tiny icon buttons on hover. Tapping one triggers the corresponding action. The state of dismissed/rescheduled items is kept in component state for the session.

## Technical Details

### 1. New Component: `src/components/accounting/BriefingActionButtons.tsx`

A small component that renders three icon buttons (X/Clock/Sparkles) inline next to a list item. It manages:
- **Ignore**: A `Popover` with a text input for the reason. On submit, calls a callback with the item text + reason, and the parent marks the item as dismissed (strikethrough + muted).
- **Reschedule**: A `Popover` with a `Calendar` (react-day-picker) date selector. On date pick, calls a callback with the item text + new date.
- **Summarize**: A simple click handler that calls the parent's `onSummarize(itemText)` callback.

### 2. Modify: `src/components/chat/RichMarkdown.tsx`

- Add an optional `onActionItem` prop with callbacks: `{ onIgnore, onReschedule, onSummarize }`.
- In the `li` component override, wrap the existing content and append `<BriefingActionButtons>` when the `onActionItem` prop is provided.
- The buttons appear on hover of the list item row (using `group` / `group-hover` Tailwind classes).

### 3. Modify: `src/components/accounting/AccountingAgent.tsx`

- Pass the `onActionItem` callbacks to `RichMarkdown` when rendering agent messages.
- `onIgnore(text, reason)`: Adds the item to a `dismissedItems` state set, optionally logs to `lead_events` or agent suggestions.
- `onReschedule(text, date)`: Logs as a future task/reminder (insert into `lead_activities` or display a toast confirmation).
- `onSummarize(text)`: Calls `handleSendDirect("Summarize this item in detail: " + text)` to ask Penny for more info.
- Track `dismissedItems` and `rescheduledItems` in component state to visually update the rendered list items (strikethrough for ignored, date badge for rescheduled).
