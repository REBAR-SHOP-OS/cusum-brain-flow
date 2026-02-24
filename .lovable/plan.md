

## Add Delete Button to All Delivery Cards

### Problem
The Delete button on the `/deliveries` page is currently only shown for deliveries with `status === "pending"`. It should be visible on all delivery cards regardless of status.

### Current State
In `src/pages/Deliveries.tsx`, the `DeliveryCard` component (line 684) wraps the delete button in a `{status === "pending" && (...)}` condition, hiding it for non-pending deliveries.

### Solution

**File: `src/pages/Deliveries.tsx`**

Remove the `status === "pending"` condition on line 684 so the Delete button (Trash icon) is always rendered in the actions area of every delivery card.

| File | Line | Change |
|---|---|---|
| `src/pages/Deliveries.tsx` | 684 | Remove `{status === "pending" && (` condition and its closing `)}` on line 697, keeping the Button inside unconditionally |

Note: There is no existing "Edit" button in the current code. This change only makes the existing Delete button visible on all delivery cards. If an Edit button is also needed, that would be a separate addition.

