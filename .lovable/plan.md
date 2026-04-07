

# Direct Bank Connection — Read-Only, No QB Conflict

## Current State

Your system has **three layers** of bank data today:

| Layer | Source | What It Does |
|-------|--------|-------------|
| `qb_bank_activity` | QB Sync Engine | Pulls ledger balance, uncleared counts, reconciled-through dates from QB |
| `bank_feed_balances` | Manual entry | Staff types in the "real" bank balance for comparison |
| `reconciliation_matches` | Auto-reconcile | Matches QB mirror transactions against Stripe charges |

**QB owns the bank feed** — it downloads transactions from BMO, categorizes them, and reconciles. That's the system of record for accounting.

## The Safe Architecture: Read-Only Bank Observer

The key principle: **QB stays the accounting authority. The ERP becomes a read-only observer of the bank.**

```text
BMO Bank ──→ Plaid (read-only) ──→ ERP (observe + alert)
BMO Bank ──→ QB Bank Feed ──→ QB (reconcile + book)
                                    │
                                    └──→ ERP (sync via qb-sync-engine)
```

**No conflict because:**
- ERP never writes to the bank
- ERP never creates QB bank transactions
- ERP only reads balances + transactions via Plaid for visibility
- QB continues to be the sole reconciliation engine

## What This Enables

1. **Real-time balance visibility** — No more manual entry in `bank_feed_balances`; Plaid pulls the actual balance automatically
2. **Transaction monitoring** — See deposits/withdrawals before QB processes them (QB bank feeds can lag 1-2 days)
3. **Variance alerts** — Auto-compare Plaid balance vs QB ledger balance; flag discrepancies immediately
4. **Cash flow forecasting** — Real transaction data feeds into projections without waiting for QB sync

## Implementation Plan

### Phase 1: Plaid Integration Setup

**New edge function: `supabase/functions/plaid-bank/index.ts`**
- Actions: `create-link-token`, `exchange-token`, `get-balances`, `get-transactions`, `sync-balances`
- Uses Plaid API (requires `PLAID_CLIENT_ID` + `PLAID_SECRET` secrets)
- Read-only access scope: `transactions`, `auth` (balance only)
- Stores connection tokens in a new `bank_connections` table

**New table: `bank_connections`**
```sql
CREATE TABLE bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  institution_name text NOT NULL,
  plaid_item_id text NOT NULL,
  access_token_encrypted text NOT NULL,  -- encrypted at rest
  account_mask text,                      -- last 4 digits
  account_name text,
  account_type text,
  linked_qb_account_id text,             -- maps to QB account for comparison
  status text DEFAULT 'active',
  last_balance_sync timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**New table: `bank_transactions_live`**
```sql
CREATE TABLE bank_transactions_live (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  connection_id uuid REFERENCES bank_connections(id),
  plaid_txn_id text UNIQUE,
  date date NOT NULL,
  description text,
  amount numeric NOT NULL,
  category text,
  pending boolean DEFAULT false,
  synced_at timestamptz DEFAULT now()
);
```

### Phase 2: Auto-Sync + Replace Manual Entry

- **Cron job** (every 4 hours): calls `plaid-bank` with action `sync-balances` → updates `bank_feed_balances.bank_balance` automatically from Plaid instead of manual entry
- **Maps Plaid accounts to QB accounts** via `linked_qb_account_id` on `bank_connections`
- The existing `BankAccountsCard` UI stays the same — it just shows auto-fetched balances instead of manually entered ones

### Phase 3: Variance Dashboard

- In `BankAccountsCard`, add a **variance column**: `Plaid Balance - QB Ledger Balance`
- Green = within $50, Yellow = $50-500, Red = >$500
- Auto-generates an alert if variance persists >24 hours

### Phase 4: Plaid Link UI

- Add "Connect Bank" button on Integrations page
- Uses Plaid Link (drop-in UI) to securely connect BMO
- After linking, map each Plaid account to its QB equivalent

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/plaid-bank/index.ts` | New — Plaid API integration |
| `src/pages/Integrations.tsx` | Add bank connection card |
| `src/components/accounting/BankAccountsCard.tsx` | Add variance column, auto-balance indicator |
| `src/hooks/useBankFeedBalances.ts` | Add Plaid sync status awareness |
| Migration | 2 new tables + RLS policies |

## Secrets Required
- `PLAID_CLIENT_ID` — from Plaid dashboard
- `PLAID_SECRET` — from Plaid dashboard (sandbox first, then production)

## Zero-Conflict Guarantee
- QB bank feed continues unchanged — downloads, categorizes, reconciles
- Plaid connection is **read-only** (no write permissions)
- ERP never creates or modifies bank transactions in QB
- The two systems observe the same bank independently — variance detection is the value add

