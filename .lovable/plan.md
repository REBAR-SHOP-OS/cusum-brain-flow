

# Fix Message Overflow in DockChatBox

## Problem
Messages in the dock chat widget overflow horizontally — text (especially forwarded messages) extends beyond the chat box boundary instead of wrapping properly.

## Root Cause
In `DockChatBox.tsx` line 618, the message bubble has `w-fit` which sizes to content width. While `break-words` and `overflow-hidden` are present, the lack of `max-w-full` means the bubble can exceed its parent container's width before word-breaking kicks in.

## Fix
**File: `src/components/chat/DockChatBox.tsx`**

Single change on line 618 — add `max-w-full` to the bubble `div` class:

```
Before: "px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden min-w-0 w-fit"
After:  "px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden min-w-0 w-fit max-w-full"
```

This constrains the bubble to never exceed its parent (`max-w-[75%]` container), ensuring all text wraps properly including forwarded messages and long strings.

## Files Changed
- `src/components/chat/DockChatBox.tsx` — add `max-w-full` to bubble className (line 618)

