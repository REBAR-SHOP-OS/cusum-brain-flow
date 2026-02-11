

## Add QuickBooks-Style Dropdowns and Filtering to Account QuickReport

### What We're Adding
Matching the QB Account QuickReport UI with proper dropdown controls and filtering, based on the reference screenshots.

### Changes

**1. `src/components/accounting/AccountQuickReportDrawer.tsx`**

Add the following controls to match the QB layout:

- **Report Period dropdown** -- A Select dropdown with preset options:
  - "Today", "This Week", "This Month", "This Quarter", "This Year", "Since 90 days ago" (default), "Since 365 days ago", "All Dates", "Custom"
  - Selecting a preset automatically sets the start date; "Custom" keeps the manual date pickers visible
- **Transaction Type filter dropdown** -- A Select dropdown to filter the displayed transactions client-side:
  - "All" (default), "Expense", "Payment", "Deposit", "Bill Payment", "Bill Payment (Cheque)", "Sales Receipt", "Refund", "Transfer", "Journal Entry"
  - Filters `transactions` array by `t.type` before rendering
- **Additional columns** to match QB screenshot:
  - "Distribution Account" column (already have "Account" -- just rename the header)
  - "Full Name" column (map from existing `account` field which contains the full account name)
  - "Cleared" column (currently not returned by backend -- will show placeholder "---" for now)
- **Layout adjustment**: Move the date controls into a toolbar row matching QB's "Report period | From" layout with the filter dropdown alongside

**2. Specific UI layout (header area)**

```
[Report period: v] [From: date] [To: date]  |  [Filter by type: v]
```

- Report period Select on the left
- Date pickers next to it (hidden when not "Custom" and the period is a preset with only a start boundary)
- Transaction type filter Select on the right

### Technical Notes
- All filtering is client-side on the already-fetched transactions array -- no backend changes needed
- The Report Period dropdown computes `startDate` and `endDate` from presets using `date-fns` helpers (e.g., `startOfMonth`, `startOfQuarter`, `startOfYear`)
- The "Cleared" column data is not available from the `TransactionListByAccount` report endpoint without adding the `cleared_status` column parameter -- this can be added to the backend in a follow-up if needed
- Select dropdowns will use the existing `@/components/ui/select` component with proper `bg-popover` background (no transparency issues)
