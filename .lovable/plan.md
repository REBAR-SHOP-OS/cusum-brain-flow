

# Fix Banking Activity — Correct Bank Balance Wiring

## The Problem

The `bank_balance` column in `qb_bank_activity` was seeded with **ledger balances** (QuickBooks `CurrentBalance`) instead of actual bank statement balances. The sync engine then preserves these wrong values on every sync, so they never get corrected.

In QuickBooks, only **BMO BUSINESS** has a bank feed with a real bank balance. The other accounts (PETTY CASH, CUSTOMER REFUND, BMO SAVINGS) show "--" for bank balance because they have no connected bank feed.

## Data Fix

Clear all wrong `bank_balance` values so the table starts clean. Only BMO BUSINESS should have a bank balance, and it needs to be manually entered ($14,971.54 per your earlier screenshot).

```
UPDATE qb_bank_activity SET bank_balance = NULL;
UPDATE qb_bank_activity SET bank_balance = 14971.54 WHERE qb_account_id = '54';
```

## Code Fix — Sync Engine

The current sync engine (line 1016-1018 of `qb-sync-engine/index.ts`) has this logic:

```
// Preserve existing bank_balance if present
if (existing?.bank_balance != null) {
  upsertRow.bank_balance = existing.bank_balance;
}
```

This is correct behavior (preserve manual entries). But the problem was the initial seed data was wrong. After the data fix above, this logic will work correctly going forward because:
- Accounts without a bank feed will have `bank_balance = NULL` (shows "--")
- Only manually entered values will be preserved

No code changes needed in the sync engine.

## Frontend Fix — BankAccountsCard.tsx

Currently the Bank Balance column shows the QB `CurrentBalance` as a fallback when no activity row exists. This fallback is wrong — if there's no `bank_balance` entry, it should show "--", not the ledger balance.

Update the fallback in the Bank Balance cell: when `activity?.bank_balance` is null, always show "--" instead of falling back to `account.CurrentBalance`.

## Summary of Changes

| Change | Type | Detail |
|--------|------|--------|
| Reset `bank_balance` for all accounts | Data fix (SQL) | Set all to NULL, then set BMO BUSINESS to $14,971.54 |
| Remove ledger fallback in Bank Balance column | Frontend fix | Show "--" when `bank_balance` is null, never fall back to `CurrentBalance` |
| No sync engine changes needed | None | The preserve logic is correct once data is fixed |

