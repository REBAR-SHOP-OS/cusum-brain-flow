
# Remove Header Penny Button and Make FAB Draggable

## What Changes

1. **Remove the "Ask Penny" button** from the accounting header bar (the one circled in red). The floating button at the bottom-right will be the only way to open/close Penny.

2. **Make the floating Penny FAB draggable** -- same drag behavior as the existing Vizzy button (tap to toggle Penny, drag to reposition, position saved to localStorage).

## Technical Details

### File: `src/pages/AccountingWorkspace.tsx`

- **Remove lines 169-178** -- the "Ask Penny" / "Close Penny" button from the header
- **Replace the static FAB** (lines 267-275) with a draggable version using the same pointer-capture drag pattern from `FloatingVizzyButton.tsx`:
  - `onPointerDown` / `onPointerMove` / `onPointerUp` with a drag threshold to distinguish click vs drag
  - Position stored in localStorage under a `penny-btn-pos` key
  - Clamped to viewport on resize
  - Click toggles `showAgent` on/off
- **Show the FAB always** (remove the `!showAgent` condition and the `lg:hidden` restriction) so it works as the sole toggle on both desktop and mobile
- The FAB will also show on desktop (not just mobile) since the header button is being removed
