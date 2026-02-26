

## Accounting Payments — Multi-Source Balance View

### Problem
The Payments tab currently shows only QuickBooks payment data. The user needs a unified view that balances payments across all four financial sources: **QuickBooks**, **Odoo** (legacy/archived), **Stripe**, and **BMO** (bank feed).

### Current State
- **QuickBooks**: Full payment data via `useQuickBooksData` hook (live API). This is the authority.
- **Stripe**: `stripe_payment_links` table + `stripe-payment` edge function. Tracks payment links, amounts, and status. No actual "payment received" data yet (only links).
- **BMO**: `qb_bank_activity` table stores ledger/bank balances per account, `bank_feed_balances` table stores manual bank balance entries. No per-transaction BMO feed exists yet.
- **Odoo**: Disabled/detached per memory. No live payment data. `wc_qb_order_map` exists for WooCommerce-to-QB mapping.

### Plan

#### 1. Source Summary Strip (top of Payments tab)
Add a 4-tile horizontal summary strip above the payments table:

```text
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  QuickBooks   │ │   Stripe     │ │   BMO Bank   │ │    Odoo      │
│  $45,230      │ │   $8,400     │ │   $52,100    │ │   (Legacy)   │
│  23 payments  │ │   5 links    │ │   Ledger Bal │ │   Detached   │
│  ● Connected  │ │  ● Connected │ │  ● Synced    │ │  ○ Archived  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

- **QB tile**: Sum of `payments[].TotalAmt` + count. Already available.
- **Stripe tile**: Query `stripe_payment_links` for active links total + count. Call `stripe-payment` `check-status`.
- **BMO tile**: Query `qb_bank_activity` for the primary chequing account's ledger balance. Show last sync time.
- **Odoo tile**: Static "Detached / Legacy" badge per memory. Show archived order count from `wc_qb_order_map` if any.

#### 2. Unified Payments Table Enhancement
Add a **Source** column to the payments table showing where each payment originates:

| Date | Customer | Amount | Source | Actions |
|------|----------|--------|--------|---------|
| 02/26 | Customer A | $1,200 | QB | View |
| 02/25 | Customer B | $800 | Stripe | View / Link |
| 02/24 | Customer C | $3,000 | QB | View |

- QB payments: existing data (tagged `source: "quickbooks"`).
- Stripe payments: merge active `stripe_payment_links` rows (tagged `source: "stripe"`), normalized to same shape.
- Source column uses color-coded badges (green=QB, purple=Stripe, blue=BMO, gray=Odoo).

#### 3. Reconciliation Indicators
Add a small reconciliation status indicator per source in the summary strip:

- **QB vs Stripe**: Compare QB invoice balance against Stripe link amount for matched `qb_invoice_id`. Show "X invoices with Stripe links" and any amount mismatches.
- **QB vs BMO**: Compare QB total collected against BMO ledger balance delta. Flag if they diverge beyond a threshold.
- Display a "Balanced" checkmark or "Variance: $X" warning per pair.

#### 4. Data Fetching
- Create a new hook `usePaymentSources` that:
  - Receives QB payments from parent `data` prop (already loaded).
  - Queries `stripe_payment_links` table filtered by `company_id`.
  - Queries `qb_bank_activity` for BMO account balances.
  - Queries `wc_qb_order_map` for Odoo/WC archived order count.
  - Returns combined, normalized payment list + per-source summaries.

#### 5. Files to Create/Modify
- **New**: `src/hooks/usePaymentSources.ts` — multi-source data aggregation hook.
- **New**: `src/components/accounting/PaymentSourceStrip.tsx` — 4-tile summary component.
- **Modify**: `src/components/accounting/AccountingPayments.tsx` — integrate strip, add Source column, merge Stripe rows into table.

### Technical Notes
- Odoo is detached per project memory. The tile will show static "Legacy / Archived" status with a count from `wc_qb_order_map`.
- BMO data comes from `qb_bank_activity` (synced from QB banking module). No direct BMO API integration — this shows the QB-side ledger balance for bank accounts.
- QuickBooks remains the authority per project rules. Stripe and BMO tiles are for cross-reference/reconciliation only.

