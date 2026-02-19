

## Full QuickBooks Banking Activity Sync

### Problem
The Banking Activity table currently uses the `bank_feed_balances` table which is manually seeded/edited. It does not mirror actual QuickBooks data for unreconciled counts, reconciled-through dates, or true ledger balances. The goal is to make ERP Banking Activity match the QuickBooks Banking screen exactly.

### Important: QuickBooks API Limitations
QuickBooks Online API does **not** expose a direct "bank balance" (the real bank statement balance) or a "reconciled through" date endpoint. What we can derive:
- **Ledger balance**: `Account.CurrentBalance` (already synced via `qb_accounts`)
- **Unreconciled count**: By querying `TransactionList` report with `cleared=UnCleared` filter per bank account
- **Reconciled-through date**: By querying `TransactionList` report with `cleared=Reconciled` and finding the max transaction date
- **Bank balance**: Must remain manually entered (QB gets this from its own Yodlee/Plaid bank feed connection, not exposed via API)

### Step 1: Create `qb_bank_activity` Table (Migration)

New table to store QB-derived banking metadata per bank account:

```text
qb_bank_activity
-----------------
id                      UUID (PK, default gen_random_uuid())
company_id              UUID NOT NULL (FK profiles lookup)
qb_account_id           TEXT NOT NULL (matches qb_accounts.qb_id)
account_name            TEXT NOT NULL
ledger_balance          NUMERIC NOT NULL DEFAULT 0
bank_balance            NUMERIC (nullable -- manual entry only)
unreconciled_count      INTEGER NOT NULL DEFAULT 0
reconciled_through_date DATE (nullable)
last_qb_sync_at         TIMESTAMPTZ
updated_by              UUID (nullable, for manual bank balance edits)
created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()
UNIQUE(company_id, qb_account_id)
```

RLS: enabled, company-scoped read/write for authenticated users.

### Step 2: Add `sync-bank-activity` Action to `qb-sync-engine`

New action in `supabase/functions/qb-sync-engine/index.ts`:

1. Query all Bank-type accounts from `qb_accounts` for the company
2. For each bank account, call QB `TransactionList` report:
   - `cleared=UnCleared` with `account={accountName}` to count unreconciled transactions
   - `cleared=Reconciled` with `account={accountName}`, sorted by date desc, to get the latest reconciled transaction date
3. Upsert results into `qb_bank_activity` with `ledger_balance` from `qb_accounts.current_balance`, `unreconciled_count`, and `reconciled_through_date`
4. Preserve any existing `bank_balance` (manual entry) -- never overwrite it during sync

### Step 3: Create `useQBBankActivity` Hook

New hook `src/hooks/useQBBankActivity.ts`:
- Fetches from `qb_bank_activity` table filtered by company_id
- Provides `upsertBankBalance(qbAccountId, bankBalance)` for manual bank balance entry
- Provides `triggerSync()` to call the sync engine with `action: "sync-bank-activity"`
- Replaces `useBankFeedBalances` for the Banking Activity card

### Step 4: Update `BankAccountsCard.tsx`

- Replace `BankFeedBalance` type with `QBBankActivity` type
- Display `ledger_balance` in "In QuickBooks" column (from synced QB data)
- Display `bank_balance` in "Bank Balance" column (manual, with pencil edit)
- Display `unreconciled_count` directly from synced data
- Display `reconciled_through_date` directly from synced data
- Add a "Sync" button in the header to trigger the bank activity sync

### Step 5: Update `AccountingDashboard.tsx`

- Replace `useBankFeedBalances` with `useQBBankActivity`
- Remove the `seedIfMissing` logic (replaced by QB sync)
- Pass new hook methods to `BankAccountsCard`

### Data Flow

```text
QuickBooks API
  |
  v
qb-sync-engine (action: sync-bank-activity)
  |-- GET /reports/TransactionList?cleared=UnCleared&account=X  --> unreconciled_count
  |-- GET /reports/TransactionList?cleared=Reconciled&account=X --> reconciled_through_date
  |-- qb_accounts.current_balance                               --> ledger_balance
  |
  v
qb_bank_activity table (Lovable Cloud DB)
  |
  v
useQBBankActivity hook --> BankAccountsCard UI
```

### Files Changed
1. **New migration**: Create `qb_bank_activity` table with RLS
2. **`supabase/functions/qb-sync-engine/index.ts`**: Add `handleSyncBankActivity` function and `sync-bank-activity` action
3. **New file `src/hooks/useQBBankActivity.ts`**: Hook for reading/writing bank activity data
4. **`src/components/accounting/BankAccountsCard.tsx`**: Rewire to use QB-mirrored data
5. **`src/components/accounting/AccountingDashboard.tsx`**: Swap hooks, add sync trigger

### What Will Match QB Exactly
- Ledger balance (In QuickBooks column) -- from `Account.CurrentBalance`
- Unreconciled transaction count -- from TransactionList report
- Reconciled-through date -- from latest reconciled transaction date

### What Remains Manual
- Bank Balance -- QB does not expose this via API (it comes from Yodlee/Plaid bank feeds internal to QB). Users can enter it via the pencil icon as before.
