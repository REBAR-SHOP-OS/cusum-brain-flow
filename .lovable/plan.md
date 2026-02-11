

## Add Visible "Thinking" Indicator to Agent Chat

### Problem
When an agent is processing, the only feedback is a tiny "thinking..." text in the top bar that's easy to miss. There's no inline typing indicator in the chat thread itself -- it looks like nothing is happening.

### Solution
Add an animated typing/thinking indicator bubble inside the chat thread, appearing right after the user's message while the agent is working. This matches the pattern already used in the Admin Console and Live Chat widget (which show a `Loader2` spinner with "Thinking..." text).

### Changes

**File: `src/components/chat/ChatThread.tsx`**
- Accept a new `isLoading` prop (boolean)
- When `isLoading` is true, render a thinking indicator at the bottom of the message list (before the scroll anchor)
- The indicator will be an agent-styled bubble with:
  - A Bot avatar (matching existing agent messages)
  - An animated three-dot bouncing indicator inside the bubble
  - Text: "Thinking..." in muted style

**File: `src/pages/AgentWorkspace.tsx`**
- Pass `isLoading` to `ChatThread`:
  ```
  <ChatThread messages={messages} isLoading={isLoading} />
  ```
- Keep the existing top-bar "thinking..." text as a secondary indicator

**File: `src/components/chat/CalChatInterface.tsx`**
- No changes needed -- it already has a typing indicator (lines 454-462), though it could be improved later

### Typing Indicator Design

```
[Bot icon]  [...   ]
            Thinking...
```

The three dots will use a CSS animation (already available via Tailwind `animate-pulse` or a custom bounce), giving clear visual feedback that the agent is working.

### What Does NOT Change
- No database changes
- No edge function changes
- No changes to message handling logic
- Admin Console and Live Chat already have their own indicators

### Files Modified
| File | Change |
|------|--------|
| `src/components/chat/ChatThread.tsx` | Add `isLoading` prop and thinking indicator bubble |
| `src/pages/AgentWorkspace.tsx` | Pass `isLoading` to `ChatThread` |

