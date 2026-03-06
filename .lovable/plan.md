

# Fix: "Set Date" Button Not Responding in Schedule Popover

## Root Cause

The `DateSchedulePopover` component renders inside a `PopoverContent`. The `Calendar` component explicitly has `pointer-events-auto` class (as required by shadcn), but the sibling elements (time selectors and buttons including "Set Date") do **not** have `pointer-events-auto`. Radix Popover applies `pointer-events: none` to the layer behind the popover, and without `pointer-events-auto` on the interactive elements, clicks on the "Set Date" button are silently swallowed.

## Fix

**File: `src/components/social/PostReviewPanel.tsx`** (lines 86-129)

Add `pointer-events-auto` to the root container of `DateSchedulePopover` so all interactive elements inside (time selects, buttons) receive click events:

```tsx
// Line 87: Change from:
<div className="p-3 space-y-3">
// To:
<div className="p-3 space-y-3 pointer-events-auto">
```

This single class addition fixes the "Set Date" button, "Post Now" button, and the time selector dropdowns inside the popover. No other files need changes.

