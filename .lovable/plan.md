
# Fix Chat Messages Overflowing Off Screen

## Problem
Long content (URLs, code blocks, script tags) in the AI Website Editor chat extends beyond the visible area, pushing half the page off screen. The existing `overflow-hidden` and `break-words` on the message bubble are insufficient because:
1. The bubble lacks `min-w-0` which is needed for flex children to actually shrink below their content size
2. Code blocks and `<pre>` elements have intrinsic minimum widths that push past the container
3. The parent scroll area doesn't constrain children's width

## Changes

### 1. `src/components/website/WebsiteChat.tsx`
- Add `min-w-0` to each message bubble div (line 125) so it properly shrinks within the flex/scroll container
- Add `w-full` to the messages container div to ensure it doesn't expand beyond the scroll area
- Add `[&_*]:max-w-full` to RichMarkdown className to force all nested elements to respect the container width

### 2. `src/components/chat/RichMarkdown.tsx`
- Add `max-w-full` and `min-w-0` to the root wrapper div (line 65) to prevent the markdown from expanding beyond its parent
- Add `overflow-wrap: anywhere` via `[overflow-wrap:anywhere]` utility to handle long unbreakable strings like URLs
- On the code block `<pre>` (line 221), ensure `max-w-full` is set alongside `overflow-x-auto`
- On inline `<code>` (line 228), add `break-all` to force long inline code to wrap

### Technical Details
These are CSS-only fixes -- no logic changes. The key insight is that `overflow-hidden` alone doesn't prevent the element from growing; `min-w-0` is required in flex/grid contexts to allow shrinking, and `overflow-wrap: anywhere` handles unbreakable strings that `word-break` misses.
