
# Fix Chat Box Frame Overflow

## Problem
Long text content (URLs, code snippets, script tags) in the Website Chat panel overflows horizontally beyond the message bubbles and panel boundaries, breaking the layout.

## Solution
Add proper text overflow handling to the chat message bubbles in `WebsiteChat.tsx`:

### Changes to `src/components/website/WebsiteChat.tsx`
1. Add `overflow-hidden break-words` to the message bubble container (the div with `rounded-xl px-3 py-2`)
2. Add `overflow-x-auto` to the RichMarkdown wrapper so code blocks get horizontal scrollbars instead of overflowing
3. Add `[&_pre]:overflow-x-auto [&_code]:break-all` to the RichMarkdown className to handle inline code and code blocks

### Technical Details
- Line 125: Add `overflow-hidden break-words` to the message `className`
- Line 132: Update RichMarkdown className to include `[&_pre]:overflow-x-auto [&_code]:break-all [&_p]:break-words`
- This ensures long URLs wrap, code blocks scroll horizontally, and no content escapes the bubble frame
