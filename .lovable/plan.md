
# Fix: Customer Edit Form Not Populating Existing Data

## Root Cause

In `src/pages/Customers.tsx` (line 327), the `CustomerFormModal` receives `onOpenChange={handleFormClose}` where `handleFormClose` is:

```typescript
const handleFormClose = () => {
  setIsFormOpen(false);
  setEditingCustomer(null);  // <-- clears the customer immediately
};
```

The problem is that `Dialog`'s `onOpenChange` callback fires with **both** `true` (opening) and `false` (closing). Since `handleFormClose` ignores the boolean argument, it always clears `editingCustomer` to `null` -- even when the dialog is opening. This triggers the `useEffect` in `CustomerFormModal` which resets the form to blank defaults.

The same bug exists in `AccountingCustomers.tsx` (line 155), where the modal is also used.

## Fix

**File: `src/pages/Customers.tsx`** -- Change `handleFormClose` to accept the `open` boolean and only clear the customer when actually closing:

```typescript
const handleFormClose = (open: boolean) => {
  setIsFormOpen(open);
  if (!open) setEditingCustomer(null);
};
```

**File: `src/components/accounting/AccountingCustomers.tsx`** -- Same fix for the `onOpenChange` handler on line 155:

```typescript
onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingCustomer(null); }}
```

## Summary

| File | Change |
|------|--------|
| `src/pages/Customers.tsx` | Fix `handleFormClose` to only clear `editingCustomer` on close (not open) |
| `src/components/accounting/AccountingCustomers.tsx` | Same fix for the form modal's `onOpenChange` |

This is a 2-line fix that ensures existing customer data populates correctly when editing.
