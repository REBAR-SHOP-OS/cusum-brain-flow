

## Fix: Duplicate Post on Regenerate in Pixel Agent

### Root Cause

Two problems cause duplicate posts when clicking "Regenerate":

1. **No loading guard in `handleSendInternal`**: When user clicks Regenerate, `handleSendInternal("regenerate slot N")` is called. There is NO check for `isLoading` — if the user clicks twice quickly (or the button re-renders mid-click), two identical requests are enqueued via `backgroundAgentService.enqueue`, both producing a post.

2. **No click debounce on PixelPostCard**: The Regenerate button calls `onRegenerate?.(post)` with zero protection against rapid/double clicks. Unlike Approve (which sets `approved = true` to block re-clicks), Regenerate has no such guard.

3. **Stale subscription accumulation**: Each call to `handleSendInternal` calls `backgroundAgentService.subscribe(sessionId, callback)` — if the previous subscription isn't cleaned up, multiple callbacks fire for the same response, appending duplicate agent messages to `messages` state.

### Changes

**File: `src/pages/AgentWorkspace.tsx`**

1. **Add `isLoading` guard at top of `handleSendInternal`**: If already loading, return early — prevents double-enqueue.
```typescript
const handleSendInternal = useCallback(async (content, slotOverride, files) => {
  if (isLoading) return; // ← guard
  ...
```

2. **Unsubscribe before re-subscribing**: Before calling `backgroundAgentService.subscribe`, unsubscribe the previous callback for the same session to prevent duplicate message appends.

**File: `src/components/social/PixelPostCard.tsx`**

3. **Add regenerating state to block double-clicks**: Add a `regenerating` state that disables the Regenerate button after first click and shows a spinner.
```typescript
const [regenerating, setRegenerating] = useState(false);

const handleRegenerate = () => {
  if (!approved && !regenerating) {
    setRegenerating(true);
    onRegenerate?.(post);
  }
};
```
Also add `disabled={regenerating}` and a spinning icon to the button.

### Files
- `src/pages/AgentWorkspace.tsx` — `isLoading` guard + unsubscribe before subscribe
- `src/components/social/PixelPostCard.tsx` — `regenerating` state to prevent double-click

