

# Fix Messages Not Displaying in DockChatBox

## Problem
Messages sent in the DockChatBox appear to be submitted but are not visually displayed in the chat area. The screenshot shows a date separator ("March 26, 2026") but no message bubbles below it, suggesting messages exist in the data but aren't rendering visually.

## Root Cause Analysis
Two likely causes identified after code review:

1. **`overflow-hidden` clipping bubbles**: The recent fix (line 570) added `overflow-hidden` to the message column container. Combined with `max-w-[75%]` and `flex flex-col`, this can cause the bubble children to collapse to zero visible height when the content (especially RTL Farsi text) doesn't establish a proper intrinsic width.

2. **`renderMentionText` regex breaking RTL text**: The `(@\S+)` regex at line 410 uses `\S+` which aggressively matches non-whitespace Unicode characters (like Farsi). If Farsi text starts with `@`-like characters or the split produces unexpected empty parts, the text could silently disappear.

3. **Scroll position issue**: The `ScrollArea` with `h-[300px]` may not be scrolling to the latest messages properly, or the `bottomRef` isn't in the visible viewport.

## Changes

### `src/components/chat/DockChatBox.tsx`

**Line 570** — Replace `overflow-hidden` with `overflow-x-hidden` to prevent horizontal overflow while allowing vertical content to remain visible:
```
"flex flex-col max-w-[75%] overflow-x-hidden"
```

**Line 605** — Add `min-w-0 w-fit` to the message bubble to ensure it has a proper intrinsic size and doesn't collapse:
```
"px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words overflow-hidden min-w-0 w-fit"
```

**Line 598** — Add a fallback: if `cleanText` is whitespace-only but not truly empty, still render it. Change the `hasText` check:
```typescript
const hasText = cleanText.length > 0 && cleanText !== "📎" && cleanText !== "🎤";
```
(The current `!!cleanText` is equivalent but the whitespace-trimmed text from `parseAttachmentLinks` could produce edge cases with Farsi text.)

## Files Changed
- `src/components/chat/DockChatBox.tsx` — 3 lines modified

