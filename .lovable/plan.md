

# QuickBooks Full Clone -- ERP Database Schema + Sync Engine

## Current State

Your system already has:
- `accounting_mirror` table (1,822 invoices, 80 vendors synced with `raw_json`-style `data` JSONB column)
- `customers` table (1,946 QB-linked customers)
- `quickbooks-oauth` edge function with full QB API access, paginated queries, token refresh, rate-limit handling
- Sync actions for customers, invoices, and vendors already working

What's **missing**: raw JSON preservation, accounts/items/transactions as first-class tables, general ledger normalization, sync logs, deletion/void tracking, nightly reconciliation, and the verification layer.

---

## Phase 1: Core QB Mirror Tables (SQL Migration)

Create dedicated, immutable mirror tables that store `raw_json` alongside parsed fields. These replace the generic `accounting_mirror` approach.

### Tables to Create

| Table | Key Columns |
|-------|------------|
| `qb_company_info` | `id, company_id, qb_realm_id, raw_json, last_synced_at` |
| `qb_accounts` | `id, company_id, qb_realm_id, qb_id, sync_token, account_type, account_sub_type, name, current_balance, is_active, is_deleted, raw_json, last_synced_at` |
| `qb_customers` | `id, company_id, qb_realm_id, qb_id, sync_token, display_name, company_name, balance, is_active, is_deleted, raw_json, last_synced_at` |
| `qb_vendors` | `id, company_id, qb_realm_id, qb_id, sync_token, display_name, company_name, balance, is_active, is_deleted, raw_json, last_synced_at` |
| `qb_items` | `id, company_id, qb_realm_id, qb_id, sync_token, name, type, unit_price, is_active, is_deleted, raw_json, last_synced_at` |
| `qb_transactions` | `id, company_id, qb_realm_id, qb_id, entity_type, sync_token, txn_date, doc_number, total_amt, balance, customer_id (nullable), vendor_id (nullable), is_voided, is_deleted, raw_json, last_synced_at` |

All tables:
- `UNIQUE(company_id, qb_id)` for upsert safety (except `qb_transactions` which uses `UNIQUE(company_id, qb_id, entity_type)`)
- RLS: admin/accounting roles can SELECT; service role can INSERT/UPDATE
- Never hard-delete rows; use `is_deleted` flag

### Existing Data Migration
- Copy 1,822 invoices and 80 vendors from `accounting_mirror` into `qb_transactions`
- Copy 1,946 customers from `customers` table into `qb_customers`
- Keep old tables intact as fallback (no destructive changes)

---

## Phase 2: General Ledger Normalization

### Tables

| Table | Key Columns |
|-------|------------|
| `gl_transactions` | `id, company_id, source ('quickbooks'), qb_transaction_id (FK), entity_type, txn_date, currency, memo, created_at` |
| `gl_lines` | `id, gl_transaction_id (FK), account_id (FK to qb_accounts), debit, credit, customer_id, vendor_id, class_id, location_id, description` |

### Derivation Rule
When a `qb_transactions` row is inserted/updated, parse its `raw_json.Line` array and create corresponding `gl_lines` entries:
- Invoice lines: debit Accounts Receivable, credit Income
- Bill lines: debit Expense, credit Accounts Payable
- Payment lines: debit Bank, credit Accounts Receivable
- Journal Entry lines: use the explicit debit/credit from QB

P&L, Balance Sheet, and Trial Balance are computed **only** from `gl_lines`.

---

## Phase 3: Sync Engine (Edge Function)

### New Edge Function: `qb-sync-engine`

Handles three modes:

**A) Historical Backfill** (`action: "backfill"`)
- Sequential order: CompanyInfo -> Accounts -> Items -> Customers -> Vendors -> Transactions (Invoice, Bill, Payment, CreditMemo, JournalEntry, Estimate, PurchaseOrder, Deposit, Transfer, VendorCredit, SalesReceipt)
- Paginate every endpoint (already have `qbQuery` with pagination)
- Store raw_json in mirror tables
- Normalize into GL

**B) Incremental Sync** (`action: "incremental"`)
- Query by `MetaData.LastUpdatedTime > last_synced_at`
- SyncToken comparison: skip if unchanged, update if changed
- Detect deletions via QB `ChangeDataCapture` endpoint
- Mark `is_deleted = true` (never hard delete)

**C) Nightly Reconciliation** (cron, `action: "reconcile"`)
- Fetch QB Trial Balance report
- Compare to ERP Trial Balance (SUM of gl_lines)
- Alert if difference > $0.01
- Repair missed updates

### Sync Safety Rules (enforced in code)
- SyncToken: skip if unchanged, update if changed, never overwrite newer
- Deletions/Voids: mark `is_deleted` or `is_voided`, preserve original GL lines
- Rate limits: existing exponential backoff (already implemented)

---

## Phase 4: Sync Logs + Verification

### Table: `qb_sync_logs`

| Column | Type |
|--------|------|
| `id` | UUID |
| `company_id` | UUID |
| `entity_type` | TEXT |
| `action` | TEXT (backfill/incremental/reconcile) |
| `qb_ids_processed` | TEXT[] |
| `synced_count` | INT |
| `error_count` | INT |
| `errors` | TEXT[] |
| `duration_ms` | INT |
| `trial_balance_diff` | NUMERIC (nullable) |
| `created_at` | TIMESTAMPTZ |

### Nightly Trial Balance Check
- Pull QB Trial Balance report via API
- Calculate ERP Trial Balance from `gl_lines`
- Log difference in `qb_sync_logs`
- If diff > $0.01, create `human_task` with severity `warning`

---

## Phase 5: Security and Access

- All new tables scoped by `company_id` with RLS
- Finance/Admin roles: full SELECT on all QB mirror + GL tables
- Agents (Penny, Vizzy): read ERP GL tables only, never QB API directly
- Existing token encryption (`tokenEncryption.ts`) continues to apply
- `financial_access_log` audit trigger extended to new tables

---

## Phase 6: Update Frontend Hook

Modify `useQuickBooksData` to optionally read from local mirror tables (ERP-native mode) instead of live QB API calls:
- Dashboard loads from `qb_transactions` + `gl_lines` (instant, no QB latency)
- Reports computed from `gl_lines` (P&L, Balance Sheet work for any historical date)
- Fallback to live QB API if mirror is empty or stale

---

## Phase 7: Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `qb-incremental-sync` | Every 15 minutes | Catch recent changes |
| `qb-nightly-reconcile` | Daily at 2 AM | Full verification + repair |

Both use vault-stored service role key (same pattern as `archive-odoo-files-batch`).

---

## Files Changed

| File | Change |
|------|--------|
| Database migration | 6 QB mirror tables, 2 GL tables, `qb_sync_logs`, RLS policies, indexes |
| `supabase/functions/qb-sync-engine/index.ts` | **New** -- backfill, incremental sync, reconciliation |
| `supabase/functions/quickbooks-oauth/index.ts` | Add `"full-sync"` and `"reconcile"` action routes that delegate to sync engine |
| `src/hooks/useQuickBooksData.ts` | Add ERP-native read mode from mirror tables |
| `src/components/accounting/AccountingDashboard.tsx` | Show sync status indicator |
| `supabase/config.toml` | Register `qb-sync-engine` function |

---

## Execution Order

1. SQL migration: create all tables + RLS + indexes
2. Data migration: copy existing `accounting_mirror` and `customers` data into new tables
3. Build `qb-sync-engine` edge function
4. Run historical backfill
5. Wire up incremental cron
6. Wire up nightly reconciliation cron
7. Update frontend to read from ERP tables
8. Verify Trial Balance matches QB

