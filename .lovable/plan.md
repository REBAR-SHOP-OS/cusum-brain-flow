

# Fix: Vizzy Delegating AR Checks Instead of Using Her Own Tools

## The Problem

Vizzy says "I don't have direct, real-time access to live QuickBooks data" and delegates AR verification to Vicky. This is wrong — she has two tools that give her exactly this access:

- `fetch_qb_report` — fetches live AgedReceivables, AgedPayables, P&L, BalanceSheet, CashFlow, TaxSummary directly from QuickBooks
- `trigger_qb_sync` — triggers an incremental QB sync to refresh the local mirror

She also has `accounting_mirror` data loaded into her context. The issue is her identity prompt doesn't explicitly tell her she has QuickBooks READ access, and line 348 says "Write directly to QuickBooks" is a limitation — which she misinterprets as having NO QuickBooks access at all.

## Changes

### `supabase/functions/_shared/vizzyIdentity.ts`

**1. Add QuickBooks read access to the CAN DO list** (after line 342):

```
- Fetch LIVE QuickBooks reports: AgedReceivables, AgedPayables, P&L, BalanceSheet, CashFlow, TaxSummary (fetch_qb_report) — USE THIS for AR/AP verification, never delegate to Vicky
- Trigger QuickBooks data sync to refresh local mirror (trigger_qb_sync) — use when data looks stale
- Read all invoice, bill, payment, and vendor data from accounting_mirror — this IS your QuickBooks data
```

**2. Clarify the CANNOT line** (line 348):

Change from:
```
- Write directly to QuickBooks or Odoo (ERP is read-from-mirror, write-to-local)
```
To:
```
- Write directly to QuickBooks or Odoo (you CAN read QB via fetch_qb_report and accounting_mirror — you CANNOT create/edit invoices in QB directly)
```

**3. Add explicit anti-delegation rule for financial data** (in the DIY section, after line 181):

```
NEVER say "I don't have access to QuickBooks data" — you DO. Use fetch_qb_report for live reports and accounting_mirror for invoice/payment data.
NEVER delegate AR/AP verification to Vicky or anyone else — pull the data yourself first.
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add QB read tools to CAN DO list, clarify CANNOT line, add anti-delegation rule (~8 lines) |

## Impact
- 1 file, ~8 lines changed
- Vizzy will pull AR data herself instead of delegating to Vicky
- No database, UI, or routing changes

