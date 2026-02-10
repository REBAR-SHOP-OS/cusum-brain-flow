

# Fix Activity Links + Add Compose Email

## Problem 1: All Activity Items Not Clickable
The right-panel "All Activity" list in `InboxDetailView.tsx` shows thread items as static divs. Clicking them should scroll to / highlight that message in the main thread on the left, or if it's a different email, navigate to it.

## Problem 2: No Compose Button
There's no way to write a new email from scratch. Users can only Reply/Forward. A "Compose" button is needed in the toolbar.

---

## Changes

### 1. Make Activity Items Clickable (InboxDetailView.tsx)
- Add `cursor-pointer` and an `onClick` handler to each activity item in the "All Activity" tab (lines 228-243)
- On click, scroll to that message in the left-side thread by setting a `highlightedCommId` state and using `scrollIntoView`
- The `InboxEmailThread` component will receive the highlighted ID to visually pulse/highlight the target message

### 2. Add Compose Email Feature

**New file: `src/components/inbox/ComposeEmailDialog.tsx`**
- A Dialog (or Sheet) with To, Subject, and Body fields
- AI Draft button to generate content from scratch (uses existing `draft-email` edge function)
- Tone adjuster chips (reuses existing pattern)
- Send via existing `gmail-send` edge function
- Undo send (5-second delay, same as reply composer)
- Templates drawer integration

**Modify: `src/components/inbox/InboxView.tsx`**
- Add a "Compose" button (with `PenSquare` icon) in the toolbar next to the view toggle
- Opens `ComposeEmailDialog` when clicked
- Keyboard shortcut `c` to open compose

### 3. Pass Click Handler to Thread (InboxEmailThread.tsx)
- Add an optional `highlightedId` prop to `InboxEmailThread`
- When set, scroll to and highlight that message with a brief animation

## Files
- **Create**: `src/components/inbox/ComposeEmailDialog.tsx`
- **Modify**: `src/components/inbox/InboxDetailView.tsx` -- clickable activity items
- **Modify**: `src/components/inbox/InboxView.tsx` -- compose button + keyboard shortcut
- **Modify**: `src/components/inbox/InboxEmailThread.tsx` -- highlight support

