
# Add Chat Memory (Persist Messages Across Refresh)

## Problem
The Website Chat (AI Job Site Editor) loses all conversation history on page refresh because messages are stored only in React state.

## Solution
Use `localStorage` to persist chat messages in the `useAdminChat` hook. Messages will be saved automatically and restored when the page loads.

### Changes to `src/hooks/useAdminChat.ts`
1. **Storage key**: Use a key like `admin-chat-{currentPage}` so different pages keep separate histories
2. **Load on init**: Initialize `messages` state from localStorage instead of an empty array
3. **Save on change**: Add a `useEffect` that writes messages to localStorage whenever they update
4. **Clear also clears storage**: Update `clearChat` to remove the localStorage entry
5. **Cap stored messages**: Only keep the last 50 messages in storage to avoid bloating localStorage

### Technical Details
- Add a `useEffect` with `messages` dependency that calls `localStorage.setItem(storageKey, JSON.stringify(messages))`
- Change `useState<AdminChatEntry[]>([])` to a lazy initializer that reads from localStorage
- Serialize timestamps as ISO strings and parse them back on load
- The `clearChat` function will call `localStorage.removeItem(storageKey)`
