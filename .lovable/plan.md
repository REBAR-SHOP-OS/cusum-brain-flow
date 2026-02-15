
## Fix: Minimize Button Not Working Properly in Fullscreen

### Problem
When the chat is in **fullscreen** mode, clicking the minimize button (`-`) sets the mode to "minimized" (thin strip), skipping the "normal" split view entirely. The user expects minimize to return to the normal 70/30 split view.

### Solution
Update the minimize button logic in `WebsiteChat.tsx` so it cycles correctly:
- **From fullscreen** -> clicking minimize goes to **normal** (split view)
- **From normal** -> clicking minimize goes to **minimized** (thin strip)
- **From minimized** -> clicking expand goes to **normal**

### File Change: `src/components/website/WebsiteChat.tsx`

Update the minimize button's `onClick` handler (around line 207):

**Current logic:**
```typescript
onClick={() => onChatModeChange?.(chatMode === "minimized" ? "normal" : "minimized")}
```

**Fixed logic:**
```typescript
onClick={() => {
  if (chatMode === "fullscreen") onChatModeChange?.("normal");
  else if (chatMode === "normal") onChatModeChange?.("minimized");
  else onChatModeChange?.("normal");
}}
```

This ensures the button always steps down one level (fullscreen -> normal -> minimized) instead of jumping from fullscreen directly to minimized.
