

# Show Inline Calendar After Welcome Message in Eisenhower Agent

## Problem
1. After the welcome message, the user must find and use the small calendar popover at the top of the page — not intuitive
2. The date-selected follow-up message (line 644) is still in Persian — missed in the previous language fix

## Changes

### 1. Create `src/components/chat/InlineDatePicker.tsx`
A chat-embedded calendar component that:
- Renders a styled `Calendar` (from shadcn/ui) directly in the message flow
- On date selection, calls a callback with the chosen date
- After selection, collapses to show the selected date as text
- Styled to match the chat bubble aesthetic

### 2. Update `src/pages/AgentWorkspace.tsx`
- Add state: `showInlineCalendar` (boolean, default false)
- In `autoStartEisenhower`: set `showInlineCalendar = true` after the welcome message
- When inline calendar date is selected: call existing `handleDateChange(date)` and set `showInlineCalendar = false`
- Pass `showInlineCalendar` and the selection handler to the chat thread area
- **Fix line 644**: Replace Persian text with English: `📅 Date **${dateStr}** selected.\n\nNow please list the **tasks you've completed** and **tasks you plan to do**.`

### 3. Render the inline calendar in the chat thread
After the messages list (before the bottom ref), conditionally render `<InlineDatePicker>` when `showInlineCalendar` is true — it appears as the next "message" in the conversation, prompting the user to pick a date.

### Files changed
| File | Action |
|------|--------|
| `src/components/chat/InlineDatePicker.tsx` | New — inline calendar component |
| `src/pages/AgentWorkspace.tsx` | Add inline calendar state + fix Persian follow-up text |

