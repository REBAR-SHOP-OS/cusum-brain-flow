

# Audit and Upgrade: Vendor UI to Full QuickBooks Parity

## Current State
The vendor system already has the core structure (VendorDetail slide-over, summary bar, CreateVendorTransactionDialog, AccountingVendorPayments). However, comparing pixel-by-pixel with your QuickBooks screenshots reveals several gaps that need fixing.

## Issues Found

### 1. Vendor Detail Transaction Table -- Missing QB Columns
**Current columns**: Date, Type, No., Total, Balance, Status
**QB columns** (from your screenshots): Date, Type, No., Payee, Category, Total Before Sales Tax, Sales Tax, Total, Action (View/Edit)

Missing: Payee, Category, Total Before Sales Tax, Sales Tax, and Action link columns.

### 2. Vendor List -- Missing "Action" Column
QB shows contextual actions per row: "Create bill" when balance is $0, "Make payment" when balance > $0 (with a dropdown chevron for more options). Current table has no Action column.

### 3. Vendor Detail -- Missing "Bill Pay ACH info" Field
QB shows "Bill Pay ACH info" next to billing address in the vendor header. This field exists in `raw_json` but is not extracted.

### 4. Vendor Detail Summary Card -- Missing "Overdue payment" Label
QB shows "Open balance" and "Overdue payment" as separate labeled amounts in a right-side summary card (like the customer Financial Summary card). Current shows them inline but not in the same styled card layout as CustomerDetail.

### 5. Summary Bar -- Missing Count Labels
QB summary bar shows counts: "18 OVERDUE", "21 OPEN BILLS", "42 PAID LAST 30 DAYS". Current shows only dollar amounts without counts.

---

## Changes

### File: `src/components/accounting/VendorDetail.tsx`
- Add QB-matching columns to transaction table: Payee (from `raw_json.VendorRef.name`), Category (from `raw_json.Line[0].AccountBasedExpenseLineDetail.AccountRef.name`), Total Before Sales Tax, Sales Tax (from `raw_json.TxnTaxDetail.TotalTax`), and Action ("View/Edit" link)
- Extract and display "Bill Pay ACH info" from `raw_json` in the header
- Style the financial summary as a proper card matching CustomerDetail's Financial Summary card layout (right-aligned, with labeled Open balance and Overdue payment)
- Add "Pay down credit card" and "Import Bills" to the New Transaction dropdown (matching QB exactly)

### File: `src/components/accounting/AccountingVendors.tsx`
- Add "Action" column to the vendor table with contextual links: "Create bill" when openBalance is 0, "Make payment" when openBalance > 0, with a dropdown chevron for more options (Create bill, Make payment, Create expense)
- Add count labels to summary bar cards: show "X OVERDUE", "Y OPEN BILLS", "Z PAID LAST 30 DAYS" under the dollar amounts
- Stop click propagation on action buttons so they don't trigger the row click

### File: `src/components/accounting/AccountingVendorPayments.tsx`
- Add vendor name search + date column formatting improvements
- Add "Status" column (derived from balance)
- Add "Account" column from `raw_json`

---

## Technical Details

- All vendor transaction data is already in `qb_transactions` with `raw_json` containing the full QB payload -- no new queries needed
- Category is extracted from `raw_json.Line[].AccountBasedExpenseLineDetail.AccountRef.name` or `raw_json.Line[].ItemBasedExpenseLineDetail.ItemRef.name`
- Sales Tax comes from `raw_json.TxnTaxDetail.TotalTax`
- Total Before Sales Tax = `total_amt - salesTax`
- Payee for bills = vendor name (already known from context)
- Bill Pay ACH info from `raw_json.BillPayACHInfo` or similar nested field
- No database changes required

