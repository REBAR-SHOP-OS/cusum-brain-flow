

# Fix: Chat Input Toolbar Cut Off on Desktop

## Problem

The LiveChat page uses `h-screen` (100vh) for its container, but it renders inside `AppLayout` which already includes a TopBar at the top. This means the total height exceeds the viewport by the height of the TopBar, pushing the input toolbar and its buttons (mic, emoji, send, etc.) below the visible area.

## Solution

Change `h-screen` to `h-full` in `LiveChat.tsx` so it fills only the available space within the AppLayout's main content area, rather than the full viewport.

## Technical Change

### File: `src/pages/LiveChat.tsx`

Line 182 (the root `div`):

```diff
- <div className="flex flex-col h-screen bg-background">
+ <div className="flex flex-col h-full bg-background">
```

This single change ensures the chat layout respects its parent container height instead of overflowing the viewport. The `<main>` wrapper in AppLayout already has `flex-1 overflow-hidden`, so `h-full` will correctly fill the remaining vertical space.

## No backend changes needed

One-line CSS class change.

