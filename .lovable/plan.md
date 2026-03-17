

## Plan: Fix Approve/Reject Icons for Default Items

### Problem
The approve (✓) and reject (✗) icons on default items have a bug: when switching between purchased and rejected states, the code **inserts a new DB row** instead of updating the existing one. This creates duplicates and breaks the toggle behavior. The `DefaultRow` component only receives `mark/unmark` functions but not the `toggle` functions that update existing records.

### Solution

**File: `src/components/purchasing/CompanyDefaultItems.tsx`**

1. Pass `onTogglePurchased` and `onToggleRejected` into `DefaultRow`
2. Fix click handlers: when a `dbMatch` already exists, use toggle (update) instead of mark (insert)
3. Keep the green title (`text-green-600`) on purchased and red title (`text-red-500`) on rejected — already works, just needs the underlying logic fix

Updated `DefaultRow` click logic:
- **Approve click**: If `dbMatch` exists → `onTogglePurchased(dbMatch.id, isPurchased)`. If no match → `onMarkPurchased(title, category)`.
- **Reject click**: If `dbMatch` exists → `onToggleRejected(dbMatch.id, isRejected)`. If no match → `onMarkRejected(title, category)`.

### Files to Modify
- `src/components/purchasing/CompanyDefaultItems.tsx` — Fix DefaultRow to use toggle when dbMatch exists

