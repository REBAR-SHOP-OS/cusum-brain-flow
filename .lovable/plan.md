
# Fix: Reply Composer Not Accessible on All Emails

## Problem
When you click Reply on an email, the reply composer can get pushed below the visible area. This happens because the email thread content expands to fill available space but doesn't properly shrink when the reply composer appears at the bottom. On longer email threads, the composer ends up off-screen.

## Root Cause
CSS flex layout issue in `InboxDetailView.tsx`: the left column and scroll area are missing `min-h-0` constraints, which prevents them from shrinking when the reply composer needs space. Additionally, the composer allows up to 45% of viewport height (`max-h-[45vh]`), which can be too much on smaller screens.

## Changes

### File: `src/components/inbox/InboxDetailView.tsx`

1. **Left column container** (line 197): Add `min-h-0` so flex children can shrink properly
   - From: `flex-1 flex flex-col min-w-0 overflow-hidden`
   - To: `flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden`

2. **ScrollArea wrapper** (line 198): Add `min-h-0` so the scroll area yields space to the composer
   - From: `<ScrollArea className="flex-1">`
   - To: `<ScrollArea className="flex-1 min-h-0">`

### File: `src/components/inbox/EmailReplyComposer.tsx`

3. **Composer max height** (line 216): Reduce from 45vh to 40vh so it doesn't crowd out the email content
   - From: `max-h-[45vh]`
   - To: `max-h-[40vh]`

### File: `src/components/inbox/InboxEmailViewer.tsx` (fallback viewer)

4. Same fix applied here -- the email content area (line 260) and composer need proper flex constraints:
   - Ensure the scrollable content area has `min-h-0` on its flex parent
   - This viewer is used in some code paths, so both viewers need the fix

These are small CSS-only changes that ensure the reply composer is always visible and accessible regardless of email length.
