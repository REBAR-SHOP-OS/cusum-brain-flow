

# Make URLs Clickable in Team Hub Chat Messages

## Problem
When a user sends a URL (e.g., YouTube link) in the Team Hub chat, it appears as plain text and is not clickable.

## Root Cause
The `renderMentionText` function in `MessageThread.tsx` (line 299) only handles `@mentions` — it splits text by `@` tokens and renders them. Plain URLs are rendered as regular `<span>` text with no `<a>` tag wrapping.

## Solution
Enhance `renderMentionText` to also detect URLs and render them as clickable `<a>` links that open in a new tab.

### `src/components/teamhub/MessageThread.tsx`

Update the `renderMentionText` function to:
1. First split text by URL pattern (`https?://...`)
2. For each URL segment, render as `<a href={url} target="_blank" rel="noopener noreferrer">` with appropriate styling (text-primary, underline, hover effect)
3. For non-URL segments, continue applying the existing `@mention` logic

This keeps mentions working and adds clickable link support in a single pass.

| File | Change |
|------|--------|
| `MessageThread.tsx` | Update `renderMentionText` to detect and render URLs as clickable `<a>` links |

