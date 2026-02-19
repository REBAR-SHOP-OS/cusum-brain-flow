

## Add Real Bank Balance to Banking Activity Table

### Problem
The Banking Activity table shows "--" for all bank balances because the `bank_feed_balances` table is empty. QuickBooks API does not expose the actual bank feed balance (the real balance from your bank). It only provides `CurrentBalance` (the book balance already shown in "In QuickBooks" column). The bank balance shown in QuickBooks comes from its internal bank feed connection, which is not accessible via API.

### Solution (Two Parts)

**1. Auto-seed bank balances from QuickBooks during data load**
When QuickBooks data loads, automatically call `list-bank-accounts` and store each bank account's `CurrentBalance` into `bank_feed_balances` as the initial bank balance. This gives a starting point instead of showing "--".

**2. Add inline edit to Banking Activity table**
Add a pencil icon on the Bank Balance column (same pattern as Chart of Accounts) so users can manually update the real bank balance for any account directly from the Banking Activity table. This lets users correct the balance to match what the actual bank shows.

### Technical Steps

**File: `src/components/accounting/BankAccountsCard.tsx`**
- Add `upsertBalance` to props (from `useBankFeedBalances`)
- Add inline edit state (editing account ID, edit value)
- Show pencil icon next to Bank Balance for each row
- On click: show input field; on Enter/confirm: call `upsertBalance`
- When no feed exists yet, show a "+" button to add a bank balance

**File: `src/components/accounting/AccountingDashboard.tsx`**
- Pass `upsertBalance` from `useBankFeedBalances` down to `BankAccountsCard`

**File: `src/hooks/useQuickBooksData.ts`**
- After loading accounts, auto-seed `bank_feed_balances` for bank-type accounts that don't already have an entry
- Call `upsertBalance` for each bank account using `CurrentBalance` as initial value (only if no existing entry)

**File: `src/hooks/useBankFeedBalances.ts`**
- Add a `seedIfMissing` function that only inserts if no row exists for that account (avoids overwriting manual edits)

### User Workflow After Implementation
1. Banking Activity table auto-populates Bank Balance with QB book balance on first load
2. User sees actual values instead of "--"
3. User can click the pencil icon to update any bank balance to match the real bank statement
4. Manual edits persist and are not overwritten by future syncs
