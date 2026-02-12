

# Fix Reply Composer Cut Off

## Problem
The reply composer opens but the Send button and toolbar at the bottom are cut off below the screen. The previous fix added `min-h-0` to the inner left column but missed the outer split container.

## Changes

### `src/components/inbox/InboxDetailView.tsx`

**Line 195** - The outer split content container needs `min-h-0` added:
- From: `flex-1 flex overflow-hidden`
- To: `flex-1 flex min-h-0 overflow-hidden`

This ensures the entire content area (thread + composer) is constrained to the available viewport height, forcing the ScrollArea to shrink and keeping the composer's Send button visible.

### `src/components/inbox/EmailReplyComposer.tsx`

**Line 216** - Change the composer from internal scrolling to a fixed-height flex layout so the toolbar/Send button is always pinned at the bottom:
- From: `max-h-[40vh] overflow-y-auto`
- To: `max-h-[40vh] flex flex-col`
- Move `overflow-y-auto` to only the textarea area (line 246), not the whole composer

This way the header, textarea (scrollable), and toolbar (with Send button) are always visible within the composer's max height.

