

## Fix Chart of Accounts - Show All Accounts with Full Info

### Problem
The Chart of Accounts only shows 4 Bank accounts because the dashboard-summary endpoint filters to `AccountType = 'Bank'`. The full account list (all types like Income, Expense, Equity, etc.) is never loaded. The table is also missing the Account Sub-Type column.

### Changes

**1. `src/hooks/useQuickBooksData.ts`**
- In the Phase 2 background loading section, add a call to `list-accounts` (the endpoint already exists in the edge function)
- Update `setAccounts` with the full list, replacing the bank-only subset from dashboard-summary

**2. `src/components/accounting/AccountingAccounts.tsx`**
- Add an "Account Sub-Type" column to the table between Account Name and Balance
- Display `a.AccountSubType` in the new column
- Sort accounts alphabetically within each group by Name
