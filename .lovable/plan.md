
# Fix Penny Scroll -- Correct Container

## Problem
The previous fix removed `overflow-hidden` from the wrong element. The scroll still doesn't work because the outer panel div (line 219) has no height constraint, so the content expands infinitely instead of being contained.

## Fix

### File: `src/pages/AccountingWorkspace.tsx`

**Desktop panel (line 219-222):** Add `overflow-hidden` to the outer panel div so it constrains to the flex-allocated height:

```
// Before:
"hidden lg:flex shrink-0 border-l border-border",
agentMode === "fullscreen" ? "flex-1" : "w-[400px]",
"p-3"

// After:
"hidden lg:flex shrink-0 border-l border-border overflow-hidden",
agentMode === "fullscreen" ? "flex-1" : "w-[400px]",
"p-3"
```

**Mobile overlay (line 240):** Same issue -- the mobile container for non-fullscreen mode needs `overflow-hidden` added so the internal scroll works within `max-h-[75vh]`.

This keeps the inner wrapper (line 224) without `overflow-hidden` (as fixed last time) so the AccountingAgent's own `overflow-y-auto` on the messages div (line 328) can handle scrolling properly.
