

# Fix Email View Overlapping Reply Composer

## Problem
When opening the reply composer in the inbox detail view, the email thread content extends behind/underneath the composer, making the reply area partially hidden. The email body should scroll independently above the pinned reply section.

## Root Cause
In `InboxView.tsx` (line 958), the wrapper div for the email detail view is missing `overflow-hidden`, which means the `h-full` on `InboxDetailView` doesn't properly constrain to the available space. This causes the scroll area to overflow past its intended boundary, pushing content behind the reply composer.

## Changes

### File: `src/components/inbox/InboxView.tsx` (line 958)
Add `overflow-hidden` to the email viewer wrapper so the detail view is properly height-constrained:

- **Before:** `"flex-1 min-h-0"`
- **After:** `"flex-1 min-h-0 overflow-hidden"`

### File: `src/components/inbox/InboxDetailView.tsx` (line 197)
The left column already has `overflow-hidden`, but the ScrollArea needs a hard height cap. Change the ScrollArea wrapper to ensure it doesn't push the composer off-screen:

- Add `overflow-hidden` to the root container (line 153) if not already present
- Ensure the left column (line 197) uses `overflow-y-hidden` so only the ScrollArea scrolls

### File: `src/components/inbox/InboxView.tsx` (line 853, kanban selected view)
The kanban path also renders `InboxDetailView` without overflow constraints. Apply the same `overflow-hidden` fix there.

## Summary
- 2 files modified: `InboxView.tsx`, `InboxDetailView.tsx`
- Adds proper overflow containment so the reply composer stays pinned at the bottom
- Email thread content scrolls independently above it
