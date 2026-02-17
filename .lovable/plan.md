

# Fix: Vendors List Not Clickable + Missing Vendor Transactions

## Problem 1: Vendors in Bills Tab Are Not Clickable

In `src/components/accounting/AccountingBills.tsx`, the "Vendors" sub-tab renders rows as plain table rows with no click handler. Unlike the dedicated Vendors tab (`AccountingVendors.tsx`), these rows cannot be clicked to view vendor details.

**Fix**: Add a `Sheet` with `VendorDetail` (same pattern used in `AccountingVendors.tsx`) and make each vendor row clickable with `cursor-pointer` and an `onClick` handler.

## Problem 2: Vendor Transactions Don't Load

In `src/components/accounting/VendorDetail.tsx` (line 161), the auto-sync logic only triggers when:
- Transactions list is empty AND
- `qbVendor?.balance > 0`

If the vendor's cached balance is 0 or null (common when mirror data is incomplete), the auto-sync never fires and the user sees "No transactions found" permanently.

**Fix**: Remove the balance check from the auto-sync condition. If there are no cached transactions, always attempt to sync them once from QuickBooks regardless of balance.

## Changes

### File: `src/components/accounting/AccountingBills.tsx`
- Import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` and `VendorDetail`
- Add `selectedVendor` state
- Add `cursor-pointer`, `hover:bg-muted/50`, and `onClick` to each vendor row
- Add a `Sheet` at the bottom that renders `VendorDetail` when a vendor is selected

### File: `src/components/accounting/VendorDetail.tsx`
- Line 161: Change the auto-sync condition from:
  ```
  transactions.length === 0 && (qbVendor?.balance ?? 0) > 0
  ```
  to:
  ```
  transactions.length === 0
  ```
  This ensures transactions are always fetched on first open regardless of cached balance.

## Summary

| File | Change |
|------|--------|
| `src/components/accounting/AccountingBills.tsx` | Add clickable vendor rows with VendorDetail sheet |
| `src/components/accounting/VendorDetail.tsx` | Remove balance > 0 gate on auto-sync |
