

# Fix Chat Message Overflow in DockChatBox

## Problem
Messages (especially forwarded ones) overflow outside the chat bubble and card boundaries. The red-circled area in the screenshot shows text and UI elements escaping the chat container.

## Root Cause
1. The bubble container at line 570 (`max-w-[75%]`) lacks `overflow-hidden`, so child elements (hover actions, attachments) can escape
2. The text bubble uses `break-words` but the rendered text from `renderMentionText` wraps each part in `<span>` without `whitespace-pre-wrap`, so forwarded messages with `\n` newlines don't wrap properly
3. The hover action bar (line 651) and attachment elements are not constrained to parent width

## Changes

### `src/components/chat/DockChatBox.tsx`

**Line 570** — Add `overflow-hidden` to the message column container:
```
"flex flex-col max-w-[75%] overflow-hidden"
```

**Line 605** — Add `whitespace-pre-wrap` to the text bubble so forwarded messages with newlines render correctly, and ensure `break-words` works:
```
"px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden"
```

**Line 651** — Constrain hover action bar width:
```
"opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0 mt-0.5 flex-wrap"
```

These 3 small changes ensure all message content stays within the bubble boundary.

## Files Changed
- `src/components/chat/DockChatBox.tsx` — 3 lines modified

