

## Add Account QuickReport (Transaction Register) Drill-Down

When clicking an account row in the Chart of Accounts, open a Sheet/Drawer showing the account's transaction history -- matching QuickBooks' "Account QuickReport" layout.

### Changes

**1. Backend: `supabase/functions/quickbooks-oauth/index.ts`**
- Add `account-quick-report` action to the switch statement
- New handler `handleAccountQuickReport` that calls the QB Reports API:
  `reports/TransactionListByAccount?account=<accountId>&start_date=<start>&end_date=<end>`
- Accepts `accountId` (required), `startDate` (defaults to 90 days ago), `endDate` (defaults to today)
- Parses the QB report response (rows with columns: Distribution Account, Transaction Date, Transaction Type, Num, Name, Memo/Description, Amount, Balance) and returns structured JSON

**2. New Component: `src/components/accounting/AccountQuickReportDrawer.tsx`**
- A full-width Sheet that slides in from the right
- Header shows account name, balance, and a "Back to Chart of Accounts" link
- Date range picker (Report Period dropdown + From date) matching QB layout
- Table with columns: Distribution Account, Date, Type, #, Name, Memo/Description, Cleared, Amount, Balance
- Beginning Balance row at the top
- Loading skeleton while fetching
- Calls `data.qbAction("account-quick-report", { accountId, startDate, endDate })` on open

**3. Update: `src/components/accounting/AccountingAccounts.tsx`**
- Add state for selected account (`selectedAccount: { Id, Name, CurrentBalance } | null`)
- Make account name cells clickable (cursor-pointer, underline on hover, blue text)
- Render `AccountQuickReportDrawer` at the bottom, controlled by `selectedAccount`

**4. Update: `src/hooks/useQuickBooksData.ts`**
- Export `qbAction` (already exported) -- no changes needed here

### Technical Notes
- The `TransactionListByAccount` report endpoint returns pre-calculated running balances, which is exactly what the QB screenshot shows
- The report response uses a nested Rows/ColData structure that needs parsing into flat transaction objects
- The Sheet will use `sm:max-w-4xl` to be wide enough for the transaction table
