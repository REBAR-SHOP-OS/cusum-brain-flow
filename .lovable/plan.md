
# Update Recents Session Title When Calendar Date Changes (Pixel Agent)

## Problem
Currently, the session title for the Pixel agent is set only once — when the first message is sent. If the user later changes the calendar date, the session title in "Recents" stays as the old date.

## Solution
When the user changes the selected date in the Pixel agent **and there's an active session**, update that session's title in the database to reflect the new date.

## Technical Changes

### `src/hooks/useChatSessions.ts`
Add a new `updateSessionTitle` function:
- Accepts `sessionId` and `newTitle`
- Runs `supabase.from("chat_sessions").update({ title: newTitle }).eq("id", sessionId)`
- Calls `fetchSessions()` to refresh the sidebar
- Return it from the hook

### `src/pages/AgentWorkspace.tsx`
Update the `handleDateChange` callback:
- Import `updateSessionTitle` from the hook
- When the agent is `social` and there's an `activeSessionId`, call `updateSessionTitle(activeSessionId, format(newDate, "yyyy-MM-dd"))` so the Recents sidebar immediately reflects the newly selected date
