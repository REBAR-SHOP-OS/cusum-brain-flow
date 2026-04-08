

# Fix: Make URLs Clickable in DockChatBox Messages

## Problem
In `DockChatBox.tsx`, the `renderMentionText` function only handles @mentions but does NOT detect or linkify URLs. When a user sends a link (e.g., a YouTube URL), it appears as plain text and is not clickable.

The `MessageThread.tsx` already has the correct implementation — it splits text by URLs first, renders them as `<a target="_blank">` links, then processes mentions within non-URL segments.

## Fix

**File: `src/components/chat/DockChatBox.tsx`** (lines 409-434)

Replace the `renderMentionText` function with the same URL-aware version used in `MessageThread.tsx`:

1. Split text by URL regex `/(https?:\/\/[^\s]+)/g` first
2. Render URL segments as `<a href={url} target="_blank" rel="noopener noreferrer">` links
3. Process @mentions only within non-URL text segments
4. Preserve existing mention styling

This is a direct port of the working logic from `MessageThread.tsx` lines 299-343.

## Result
All URLs in direct messages will be clickable and open in a new browser tab — matching the behavior already present in channel/thread messages.

