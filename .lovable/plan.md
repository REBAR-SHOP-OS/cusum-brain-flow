

## Plan: Fix DockChatBox Pointer Events

### Problem
The `DockChatBox` is rendered inside the floating portal container (`#floating-layer`), which has `pointer-events: none`. The `DockChatBar` launcher button correctly adds `pointer-events-auto`, but `DockChatBox` does not — making the input field, close button, and all interactive elements unclickable.

### Fix

**File: `src/components/chat/DockChatBox.tsx`**

Add `pointer-events-auto` class to both the minimized pill (line 269) and the expanded chat box (line 294).

- Line 269: Add `pointer-events-auto` to the minimized container div
- Line 294: Add `pointer-events-auto` to the main expanded container div

Two class additions, same file. No other changes needed.

