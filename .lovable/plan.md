

## Plan: Make "Chat Mode" Card Enter Chat View

### Problem
The "ساخت عکس با چت" card currently does nothing — hero state stays visible because `hasConversation` is `false` (no messages).

### Fix

**File: `src/pages/AgentWorkspace.tsx`**

Change the chat mode card's `onClick` from no-op to sending a brief starter message that transitions the user into the chat view. The message will be a natural greeting/prompt to the agent:

```typescript
onClick={() => handleSend("Ready to create images via chat. What should I make?")}
```

This triggers `handleSend`, which adds a message to the conversation → `messages.length > 0` → `hasConversation` becomes true → hero disappears and the normal chat UI with the toolbar (Style, Products, Aspect Ratio selectors) appears.

The user can then type freely and use the toolbar controls to customize their image requests.

### Single file change
- `src/pages/AgentWorkspace.tsx` — line 672, change the `onClick` handler

