
# Auto-Open Team Chat on New Messages (Odoo-Style)

## Overview
When a new team message arrives, the chat panel should automatically open if the user isn't typing elsewhere. If the user IS busy typing, show a toast with an "Open Chat" button instead. This requires lifting the chat panel's open/close state out of `TopBar` into a shared context so the notification system can trigger it.

## Changes

### 1. New file: `src/contexts/ChatPanelContext.tsx`
Create a lightweight React context that holds:
- `chatOpen` (boolean) and `setChatOpen`
- `openChatToChannel(channelId: string)` -- opens the panel and navigates to a specific channel
- `pendingChannelId` -- so GlobalChatPanel can auto-select the right channel when opened

### 2. Update `src/components/layout/TopBar.tsx`
- Remove local `chatOpen` / `setChatOpen` state
- Consume `ChatPanelContext` instead
- Pass context values to `GlobalChatPanel`

### 3. Update `src/components/layout/GlobalChatPanel.tsx`
- Accept an optional `initialChannelId` prop from context
- When `initialChannelId` changes and the panel opens, auto-select that channel

### 4. Update `src/hooks/useNotifications.ts`
- For INSERT notifications where `metadata.channel_id` exists (team chat messages), instead of a generic toast:
  - Check if the user is actively typing (via `document.activeElement` tag check -- if an input/textarea is focused, they're typing)
  - If NOT typing: call `openChatToChannel(channelId)` to auto-open the panel
  - If typing: show a sonner toast with an "Open Chat" action button that calls `openChatToChannel(channelId)`
- This requires `useNotifications` to accept an optional callback, OR we create a separate hook/listener

Since `useNotifications` is a hook (not a component with context access), the cleanest approach is:
- Add a **global event emitter** pattern (simple custom event on `window`) -- `team-chat-incoming` with `channelId` in detail
- Fire this event from `useNotifications` when a team chat notification arrives
- Listen for it in `TopBar` (or the context provider) to open the chat panel

### 5. Wire into `AppLayout.tsx`
- Wrap the layout with `ChatPanelProvider`

## Technical Details

**New file: `src/contexts/ChatPanelContext.tsx`**
```typescript
// React context with chatOpen, setChatOpen, openChatToChannel, pendingChannelId
```

**In `useNotifications.ts` (INSERT handler):**
```typescript
// When metadata has channel_id (team chat notification)
if (newRow.metadata?.channel_id) {
  window.dispatchEvent(new CustomEvent("team-chat-incoming", {
    detail: { channelId: newRow.metadata.channel_id, title: newRow.title, description: newRow.description }
  }));
  // Skip the generic toast -- the listener will handle it
  return;
}
```

**In `ChatPanelProvider`:**
```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    const { channelId, title, description } = e.detail;
    const isTyping = document.activeElement?.tagName === "INPUT" || 
                     document.activeElement?.tagName === "TEXTAREA";
    if (!isTyping) {
      // Auto-open chat panel to that channel
      setPendingChannelId(channelId);
      setChatOpen(true);
    } else {
      // Show toast with "Open Chat" button
      toast(title, {
        description,
        duration: 8000,
        action: { label: "Open Chat", onClick: () => { setPendingChannelId(channelId); setChatOpen(true); } },
      });
    }
  };
  window.addEventListener("team-chat-incoming", handler);
  return () => window.removeEventListener("team-chat-incoming", handler);
}, []);
```

## Files Modified
| File | Change |
|------|--------|
| `src/contexts/ChatPanelContext.tsx` | New -- context provider for chat panel state |
| `src/components/layout/TopBar.tsx` | Use context instead of local state for chatOpen |
| `src/components/layout/GlobalChatPanel.tsx` | Accept + react to `pendingChannelId` prop |
| `src/components/layout/AppLayout.tsx` | Wrap with `ChatPanelProvider` |
| `src/hooks/useNotifications.ts` | Fire custom event for team chat notifications |

No database changes needed.
