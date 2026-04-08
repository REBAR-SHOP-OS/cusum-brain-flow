

# Enlarge DockChatBox UI

## Problem
The chat box is too narrow (`w-[320px]`) and too short (`h-[300px]` message area), making images and messages hard to see — as shown in the screenshot.

## Changes

### `src/components/chat/DockChatBox.tsx`

| Element | Current | New |
|---------|---------|-----|
| Container width | `w-[320px]` (line 505) | `w-[370px]` |
| Messages ScrollArea | `h-[300px]` (line 543) | `h-[400px]` |
| Image max-width | `max-w-[200px]` (line 651) | `max-w-[260px]` |
| Image max-height | `max-h-[160px]` (line 651) | `max-h-[220px]` |

### `src/components/chat/DockChatBar.tsx`

| Element | Current | New |
|---------|---------|-----|
| `BOX_WIDTH` constant | `330` (line 134) | `380` |

This ensures chat boxes don't overlap when multiple are open.

