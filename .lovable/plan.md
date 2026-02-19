

# Fix Sync QB — Three Broken API Calls

## Problems Found in Edge Function Logs

The sync engine has three failing API interactions, all confirmed by the logs:

### 1. Account Balance Fetch (400 Error)
The `Account/{id}` endpoint returns "Unsupported Operation" for every bank account. The sync falls back to the stale `current_balance` from the `qb_accounts` table, so BMO BUSINESS stays at $32,035.28 instead of the real QB value.

**Fix**: Replace individual `Account/{id}` calls with a single QB Query API call:
`query?query=SELECT Id, Name, CurrentBalance FROM Account WHERE AccountType = 'Bank' AND Active = true`

This fetches all bank accounts and their live balances in one efficient API call. Build a lookup map by account ID, then use it during the per-account loop.

### 2. Unreconciled Count (Same 34 for All Accounts)
The `TransactionList` report uses `account=ACCOUNT_NAME` as a filter, but this is not filtering correctly -- all 4 accounts return exactly 34 rows, meaning the filter is being ignored.

**Fix**: The existing `quickbooks-oauth` function (line 1539) uses the `TransactionListByAccount` report type which natively groups by account ID. Switch the sync engine to either:
- Use the correct report endpoint: `reports/TransactionListByAccount?account={ACCOUNT_ID}` (using numeric ID, not name)
- This matches the proven pattern already working in the codebase

### 3. Reconciled Through Date (Always Null)
Same filter issue as above -- the reconciled `TransactionList` report returns no matching rows because the account name filter is not working.

**Fix**: Use `reports/TransactionListByAccount?account={ACCOUNT_ID}&cleared=Reconciled&sort_order=descend&sort_by=tx_date&columns=tx_date` with numeric account ID.

---

## Technical Changes

### File: `supabase/functions/qb-sync-engine/index.ts`

**Before the per-account loop** (around line 975):
- Add a single QB Query API call to fetch all bank account balances at once
- Build a `Map<string, number>` of account ID to `CurrentBalance`

**Replace the live account fetch** (lines 983-996):
- Remove the individual `Account/{id}` try/catch block
- Look up the live balance from the pre-built map instead

**Fix unreconciled report** (lines 998-1011):
- Change from `reports/TransactionList?cleared=Uncleared&account=${encodeURIComponent(account.name)}`
- To: `reports/TransactionListByAccount?account=${account.qb_id}&cleared=Uncleared&columns=tx_date,txn_type,doc_num,name,memo,subt_nat_amount`

**Fix reconciled report** (lines 1013-1026):
- Change from `reports/TransactionList?cleared=Reconciled&account=${encodeURIComponent(account.name)}`
- To: `reports/TransactionListByAccount?account=${account.qb_id}&cleared=Reconciled&sort_order=descend&sort_by=tx_date&columns=tx_date`

No database or frontend changes needed.

