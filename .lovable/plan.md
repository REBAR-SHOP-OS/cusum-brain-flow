

# Fix Penny's Data Access and Mobile Chat Overflow

## Problems Identified

### Problem 1: Penny sees zeros / incomplete data
Three root causes:

**A. Server-side (ai-agent edge function):**
- QB API queries use `MAXRESULTS 50` for customers, `MAXRESULTS 30` for invoices, `MAXRESULTS 20` for payments -- missing older data
- P&L report only fetches from January 1 of the CURRENT year, not from business inception
- No bills are fetched at all in `fetchQuickBooksLiveContext`
- No vendors fetched

**B. Client-side (AccountingAgent.tsx):**
- Follow-up messages (lines 193-199 and 507-512) only send 5 summary counts to Penny: `totalReceivable`, `totalPayable`, `overdueInvoiceCount`, `overdueBillCount`, `unpaidInvoiceCount`
- No invoice details, customer names, amounts, aging data, or account balances
- The auto-greet passes rich data but every subsequent question gets almost nothing

### Problem 2: Chat panel overflows on mobile
- The mobile overlay panel (line 236-248) uses `inset-x-3 bottom-3` with no height cap, so the chat grows beyond the viewport
- No close/minimize button visible on mobile -- the only way to close is the header button which scrolls out of view

---

## Plan

### Phase 1: Expand server-side QB data fetching (ai-agent edge function)

In `fetchQuickBooksLiveContext`:
- Increase `MAXRESULTS` to 200 for customers, 200 for invoices, 100 for payments, 100 for accounts
- Fetch ALL invoices (not just open ones) with a second query: `SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 200`
- Add bills query: `SELECT * FROM Bill WHERE Balance > '0' MAXRESULTS 100`
- Add vendors query: `SELECT * FROM Vendor MAXRESULTS 100`
- Change P&L date range from current year start to business inception (use company fiscal year or default to 5 years back)
- Add Aged Receivable report: `reports/AgedReceivableDetail`
- Add Aged Payable report: `reports/AgedPayableDetail`

### Phase 2: Pass full context in follow-up messages (AccountingAgent.tsx)

In both `handleSend` (line 193) and `handleSendDirect` (line 507), expand the `qbContext` to include:
- Full overdue invoices list (top 20 with customer, amount, days overdue)
- Full overdue bills list (top 20)
- All bank account balances
- Recent payments (last 10)
- Total unpaid invoice and bill counts
- Customer list with balances (top 20)
- Penny collection queue summary (pending count, total AR at risk)

This ensures every follow-up question Penny answers has the same rich data as the auto-greet.

### Phase 3: Fix mobile chat overflow and add minimize access

In `AccountingWorkspace.tsx` mobile overlay (line 236-248):
- Add `max-h-[75vh]` when not fullscreen so the chat never exceeds 75% of viewport height
- The AccountingAgent component already has minimize/fullscreen buttons in its header, but the mobile overlay needs a close button
- Add a visible close (X) button at the top-right of the mobile overlay for quick dismissal

In `AccountingAgent.tsx` root div (line 277):
- Ensure `h-full` and `max-h-full` so the chat respects its container's height constraint
- The messages area already has `overflow-y-auto` which is correct

---

## Technical Details

### Files Modified (3)

| File | Changes |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | Expand QB queries: higher MAXRESULTS, add bills/vendors, extend P&L date range, add aged reports |
| `src/components/accounting/AccountingAgent.tsx` | Pass full QB data (invoices, bills, accounts, payments, queue) in follow-up message context |
| `src/pages/AccountingWorkspace.tsx` | Add `max-h-[75vh]` and close button to mobile chat overlay |

### Key Changes

**ai-agent/index.ts -- fetchQuickBooksLiveContext:**
- Invoices: `SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 200` (all, not just open)
- Bills: `SELECT * FROM Bill ORDERBY TxnDate DESC MAXRESULTS 100` (new)
- Vendors: `SELECT * FROM Vendor MAXRESULTS 100` (new)
- Customers: increase from 50 to 200
- Payments: increase from 20 to 100
- P&L: change start date from current Jan 1 to 5 years back (covers business history)
- Add Aged Receivables and Aged Payables summary reports

**AccountingAgent.tsx -- qbContext in handleSend and handleSendDirect:**
```typescript
const qbContext = qbSummary ? {
  totalReceivable: qbSummary.totalReceivable,
  totalPayable: qbSummary.totalPayable,
  overdueInvoices: qbSummary.overdueInvoices.slice(0, 20).map(i => ({
    doc: i.DocNumber, customer: i.CustomerRef?.name, balance: i.Balance, due: i.DueDate
  })),
  overdueBills: qbSummary.overdueBills.slice(0, 20).map(b => ({
    doc: b.DocNumber, vendor: b.VendorRef?.name, balance: b.Balance, due: b.DueDate
  })),
  bankAccounts: qbSummary.accounts.filter(a => a.AccountType === "Bank")
    .map(a => ({ name: a.Name, balance: a.CurrentBalance })),
  recentPayments: qbSummary.payments.slice(0, 10).map(p => ({
    amount: p.TotalAmt, date: p.TxnDate
  })),
  unpaidInvoiceCount: qbSummary.invoices.filter(i => i.Balance > 0).length,
  unpaidBillCount: qbSummary.bills.filter(b => b.Balance > 0).length,
} : {};
```

**AccountingWorkspace.tsx -- mobile overlay:**
```typescript
<div className={cn(
  "lg:hidden fixed z-50",
  agentMode === "fullscreen"
    ? "inset-0 bg-background p-3"
    : "inset-x-3 bottom-3 max-h-[75vh] rounded-xl shadow-2xl overflow-hidden"
)}>
```

