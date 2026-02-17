
# Bottom-Docked Multi Chat Boxes (Odoo-Style)

## Overview

Replace the current right-side `GlobalChatPanel` with Odoo-style bottom-docked chat boxes. Multiple chat windows sit side-by-side at the bottom of the screen, persist across page navigation, and can be individually minimized, maximized, or closed.

---

## How It Works

When a user clicks a team member or channel from the chat list, a small chat box opens at the bottom-right of the screen. Opening another conversation adds a second box next to it. Each box can be independently minimized (collapsed to just the header bar) or closed. The boxes persist as the user navigates between pages because they live inside `AppLayout`, outside the routed content.

**Max open boxes**: 4 on desktop, 1 on mobile (auto-minimizes older ones to prevent overflow).

---

## Changes by File

### 1. NEW: `src/components/chat/DockChatBox.tsx`

A single docked chat box component (approximately 320px wide, 400px tall). Features:
- Header bar with: avatar/name, minimize button (dash icon), close button (X), expand button (opens full Team Hub)
- Message list (reuses existing `useTeamMessages` hook)
- Text input with Send button
- Minimized state: only the header bar is visible (clickable to restore)
- Unread badge on minimized header

### 2. NEW: `src/contexts/DockChatContext.tsx`

Global context that manages the array of open chat boxes. State shape:
```text
openChats: Array<{
  channelId: string
  channelName: string
  channelType: "dm" | "group"
  minimized: boolean
}>
```

Actions:
- `openChat(channelId, name, type)` -- adds to array (max 4, auto-minimizes oldest if over limit)
- `closeChat(channelId)` -- removes from array
- `toggleMinimize(channelId)` -- toggles minimized state
- `minimizeAll()` -- minimizes all open boxes

Guard: duplicate `channelId` calls `openChat` just un-minimizes the existing box (no duplicates).

### 3. NEW: `src/components/chat/DockChatBar.tsx`

Container component rendered inside `AppLayout`. Renders `DockChatBox` instances side-by-side, positioned `fixed bottom-0 right-20` with each box offset by its index. Also renders a small "chat launcher" pill that opens the channel list popover (reusing channel list UI from `GlobalChatPanel`).

### 4. MODIFY: `src/components/layout/AppLayout.tsx`

- Wrap children with `DockChatProvider`
- Replace `<LiveChatWidget />` with `<DockChatBar />`
- Keep `FloatingVizzyButton` as-is (it opens the AI chat page, separate concern)

### 5. MODIFY: `src/contexts/ChatPanelContext.tsx`

- Update `openChatToChannel` to call `DockChatContext.openChat` instead of opening the side panel
- The `chatOpen` / `setChatOpen` state for `GlobalChatPanel` is preserved but the TopBar button now opens the dock launcher popover instead

### 6. MODIFY: `src/components/layout/TopBar.tsx`

- The chat icon button now calls `openChatToChannel` to open the dock launcher or toggles the channel list popover
- Remove the `GlobalChatPanel` side-panel rendering (replaced by dock boxes)

### 7. KEEP: `src/components/layout/GlobalChatPanel.tsx`

- Retained but no longer rendered from TopBar. Its channel-list UI logic is extracted/reused by `DockChatBar`'s launcher popover.

---

## Technical Details

### Positioning
```text
Fixed bottom-0, boxes arranged right-to-left:
  Box 0: right-20 (offset for Vizzy button)
  Box 1: right-20 + 330px
  Box 2: right-20 + 660px
  Box 3: right-20 + 990px
```

On mobile (viewport < 768px): only 1 box at a time, full-width minus padding.

### Persistence Across Navigation
The `DockChatProvider` lives in `AppLayout` which wraps all routed pages. Open chat state is held in React context (not URL), so navigating between pages does not close or reset the boxes.

### Throttling and Guards
- `openChat` is debounced (100ms) to prevent double-click spam
- Max 4 open boxes enforced; 5th call auto-minimizes the oldest
- Duplicate channelId guard: re-focuses existing box instead of creating a new one
- Message sending reuses existing `useSendMessage` hook with its built-in error handling

### No Domino Effects
- The `/chat` page (AI LiveChat) is untouched
- The `FloatingVizzyButton` is untouched
- Team Hub full page is untouched
- `useTeamChat` hooks are reused as-is, no modifications
- Existing `ChatPanelContext` event listener for `team-chat-incoming` still works, just routes to dock instead of side panel

---

## Files Summary

| File | Action |
|------|--------|
| `src/contexts/DockChatContext.tsx` | **New** -- multi-chat state management |
| `src/components/chat/DockChatBox.tsx` | **New** -- single docked chat window |
| `src/components/chat/DockChatBar.tsx` | **New** -- container + channel launcher |
| `src/components/layout/AppLayout.tsx` | **Edit** -- add DockChatProvider + DockChatBar, remove LiveChatWidget |
| `src/contexts/ChatPanelContext.tsx` | **Edit** -- route openChatToChannel to dock context |
| `src/components/layout/TopBar.tsx` | **Edit** -- swap GlobalChatPanel for dock launcher |
