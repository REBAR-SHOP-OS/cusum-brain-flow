

## Fix: "All Deliveries" Count Mismatch

### Problem

The "All" tab header shows a count (e.g., 8) that doesn't match the number of deliveries visually rendered below. Items are being clipped/hidden because of a CSS overflow issue in the scroll container.

### Root Cause

In `src/pages/Deliveries.tsx`, the "All" tab uses `overflow-hidden` on the `TabsContent` container (line 383) combined with `ScrollArea` using `h-full`. When the flex layout doesn't propagate a concrete pixel height down to the scroll area, the scrollable region gets truncated, hiding some delivery cards while the count badge still shows the full array length.

### Solution

**File: `src/pages/Deliveries.tsx`**

Change the "All" tab's `TabsContent` wrapper to use `overflow-auto` instead of `overflow-hidden`, and ensure the `DeliveryList` scroll area has a max-height fallback so all items are scrollable. Also apply the same fix to the "Today" and "Upcoming" tabs for consistency.

Specifically:

1. **Lines 359, 371, 383**: Change `overflow-hidden` to `overflow-auto` on all three `TabsContent` containers
2. **Line 637 (DeliveryList component)**: Change the `ScrollArea` from `h-full` to a calculated height using `max-h-[calc(100vh-300px)]` so it always has a concrete scrollable boundary regardless of flex layout

### Summary of Changes

| File | Line(s) | Change |
|---|---|---|
| `src/pages/Deliveries.tsx` | 359, 371, 383 | `overflow-hidden` to `overflow-auto` |
| `src/pages/Deliveries.tsx` | 637 | `ScrollArea` from `h-full` to `max-h-[calc(100vh-300px)] h-full` |

This ensures all delivery cards in the array are scrollable/visible, making the count always match the rendered items.

