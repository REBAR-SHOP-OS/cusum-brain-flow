

## Revert Home Page Chat and Add Live Chat Button to ChatInput

### What changes

1. **Home.tsx** - Remove all inline chat functionality (messages display, streaming controls, `useAdminChat` hook, `chatBottomRef`, etc.). Restore the original behavior where the ChatInput routes to the appropriate agent page. Keep everything else (helpers, workspaces, quick actions) untouched.

2. **ChatInput.tsx** - Add a new `MessageCircle` (live chat) icon button to the bottom toolbar, next to the existing icons (paperclip, emoji, voice, etc.). Clicking it will toggle the LiveChatWidget open.

3. **ChatInput props** - Add an optional `onLiveChatClick` callback prop. When provided, the live chat button appears in the toolbar.

4. **Home.tsx wiring** - Pass an `onLiveChatClick` handler from Home that triggers the LiveChatWidget to open. This will use a simple state or a shared callback approach.

### Technical Details

**ChatInput.tsx changes:**
- Add optional prop `onLiveChatClick?: () => void`
- Import `MessageCircle` from lucide-react
- Add a new tooltip button in the bottom toolbar (after the Hash/commands button) with the `MessageCircle` icon, visible only when `onLiveChatClick` is provided
- On click, call `onLiveChatClick()`

**Home.tsx changes:**
- Remove: `useAdminChat` import/hook, `chatBottomRef`, `Loader2`/`Square`/`Button` imports (if only used for chat), `RichMarkdown` import, the entire inline messages block, the `cancelStream` cleanup effect, and the `handleSend` callback that calls `sendMessage`
- Restore: the original `handleSend` that uses `routeToAgent` to navigate to the right agent page with the message
- Pass `onLiveChatClick` to `ChatInput` which sets the LiveChatWidget open state

**LiveChatWidget.tsx changes:**
- Export a way to open it externally. Options:
  - Option A: Expose an `externalOpen` prop or use a lightweight context/ref
  - Option B (simpler): Add a custom event listener approach - dispatch a `CustomEvent` when the ChatInput button is clicked, and the LiveChatWidget listens for it

The simplest approach: LiveChatWidget listens for a `window` custom event `"open-live-chat"`, and ChatInput's `onLiveChatClick` dispatches that event. This requires zero prop drilling through the layout.

**Sequence:**
1. Update `ChatInput.tsx` - add `onLiveChatClick` prop and MessageCircle button
2. Update `LiveChatWidget.tsx` - add event listener for `"open-live-chat"` custom event
3. Update `Home.tsx` - remove inline chat, restore agent routing, pass `onLiveChatClick={() => window.dispatchEvent(new Event("open-live-chat"))}` to ChatInput
