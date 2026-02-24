

## Fix: Void Invoice Button Appears Unresponsive

### Problem
Clicking the "Void" button in the invoice list correctly opens the confirmation dialog. However, clicking "Yes, Void Invoice" inside the dialog:
1. Instantly closes the dialog (due to Radix `AlertDialogAction` auto-close behavior) before the async operation completes
2. Shows no loading or success/failure feedback to the user
3. Has no `catch` block in `handleVoid`, so errors are silently swallowed

The edge function call also fails with `net::ERR_FAILED` in some cases, but users see no error -- just the dialog closing with no visible result.

### Root Cause
The `ConfirmActionDialog` component uses Radix's `AlertDialogAction` for the confirm button. This component **automatically closes the dialog on click** before the `onClick` handler (the async void operation) completes. The dialog disappears, the loading state is never visible, and if the operation fails, no error toast is shown.

### Solution

**File: `src/components/accounting/ConfirmActionDialog.tsx`**

Replace `AlertDialogAction` with a regular `Button` component. This prevents auto-closing and lets the dialog stay open while the async operation runs, showing the "Processing..." loading state. The dialog only closes when the parent sets `open` to `false` (via `onOpenChange`).

Changes:
- Replace `AlertDialogAction` import with `Button` import
- Replace `<AlertDialogAction onClick={onConfirm} ...>` with `<Button onClick={onConfirm} ...>` so the dialog stays open during processing

**File: `src/components/accounting/AccountingInvoices.tsx`**

Add a `catch` block to `handleVoid` to show an error toast when the void operation fails.

Changes:
- Add `toast` import from hooks (already available via `data` -- check if `toast` is accessible or import `useToast`)
- Add `catch` block: `catch (err) { toast({ title: "Void failed", description: err.message, variant: "destructive" }); }`

### Technical Details

| File | Change | Lines |
|------|--------|-------|
| `ConfirmActionDialog.tsx` | Replace `AlertDialogAction` with `Button` | Lines 1-10 (imports), Line 63-68 (component) |
| `AccountingInvoices.tsx` | Add `catch` block to `handleVoid` | Lines 86-95 |

