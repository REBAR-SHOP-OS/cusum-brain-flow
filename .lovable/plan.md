

## Move DELETE Button to Bottom-Right of Customer Detail Panel

### Problem
The DELETE button (trash icon) in the Customer Detail panel is currently positioned in the header area alongside the Edit and New Transaction buttons. It should be at the bottom-right corner of the panel instead.

### Solution

**File: `src/components/customers/CustomerDetail.tsx`**

Two changes:

1. **Remove** the AlertDialog block (lines 429-449) from the header actions area
2. **Add** the same AlertDialog block at the bottom of the outer container (before the closing `</div>` at line 952), positioned absolutely at bottom-right

Specifically:
- Add `relative` to the outer container's className (line 382): `"flex flex-col h-full relative"`
- Move the entire AlertDialog (delete button + confirmation dialog) from lines 429-449 to a new block just before the closing tag, wrapped in a `div` with `absolute bottom-4 right-4` positioning

### What is NOT Changed
- No logic changes -- same `onDelete` handler, same confirmation dialog
- No other UI elements modified
- No database or other component changes
