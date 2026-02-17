
# Audit & Fix: Customer Detail -- Edit Not Wired, Delete Unsafe

## Problems Found

### 1. Edit button not wired in Accounting Customers
In `AccountingCustomers.tsx` (line 147), the `onEdit` handler is `() => {}` -- clicking Edit does nothing.

### 2. Delete button not wired in Accounting Customers
In `AccountingCustomers.tsx` (line 148), the `onDelete` handler is `() => {}` -- clicking Delete does nothing.

### 3. Delete button is unsafe everywhere
In `CustomerDetail.tsx` (line 386), the Delete button directly calls `onDelete()` with no confirmation dialog. The confirmation in `Customers.tsx` uses a basic `window.confirm()` which is not a proper UI pattern. Delete should use an `AlertDialog` for safe confirmation.

---

## Fix Plan

### 1. Move delete confirmation INTO CustomerDetail using AlertDialog
Instead of relying on parent components to add confirmation, add an `AlertDialog` directly inside `CustomerDetail.tsx` wrapping the delete button. This ensures delete is always safe regardless of which parent renders it.

**File: `src/components/customers/CustomerDetail.tsx`**
- Import `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger`
- Wrap the existing delete button in `AlertDialogTrigger`
- Show confirmation dialog: "Are you sure? This will permanently delete this customer."
- Only call `onDelete()` when user confirms

### 2. Wire Edit and Delete in AccountingCustomers
**File: `src/components/accounting/AccountingCustomers.tsx`**
- Add `editingCustomer` state and `useMutation` for delete (same pattern as `Customers.tsx`)
- Wire `onEdit` to open `CustomerFormModal` with the selected customer
- Wire `onDelete` to execute the delete mutation, close the sheet, and invalidate queries
- Pass the editing customer to `CustomerFormModal` (currently always passes `null`)

### 3. Remove redundant confirm() from Customers.tsx
**File: `src/pages/Customers.tsx`**
- Remove the `window.confirm()` from `handleDelete` since confirmation is now built into `CustomerDetail`

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Replace bare delete button with AlertDialog confirmation |
| `src/components/accounting/AccountingCustomers.tsx` | Wire onEdit to open form modal, wire onDelete with mutation |
| `src/pages/Customers.tsx` | Remove redundant window.confirm() from handleDelete |
