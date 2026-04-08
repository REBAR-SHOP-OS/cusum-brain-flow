

# Enlarge Chat Popover UI

## Problem
The chat launcher popover (`w-[300px]`, `max-h-[400px]`) is too small — team members and channels get cut off, especially the unread badges on the right side (visible in the screenshot as red dots being clipped).

## Change

**File:** `src/components/chat/DockChatBar.tsx`

| Current | New |
|---------|-----|
| `className="w-[300px] p-0 mb-2"` (line 174) | `className="w-[340px] p-0 mb-2"` |
| `className="max-h-[400px]"` (line 175, ScrollArea) | `className="max-h-[520px]"` |

Width increases from 300→340px so names and badges aren't clipped. Max height increases from 400→520px so all 8 team members + channels + DMs section are visible without scrolling.

