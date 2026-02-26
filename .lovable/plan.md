

# Accounting Dashboard Redesign Plan

## Current Issues

Looking at the screenshot and code, the dashboard has several UX problems:

1. No financial summary -- users land on the page with no immediate sense of their financial position
2. Flat visual hierarchy -- all cards look identical in weight and importance
3. Cramped card layout -- Invoices and Bills cards are squeezed into a narrow 2-column grid with tiny 9px text
4. Cash card is nearly empty -- just one line of data
5. Banking Activity interrupts the flow between summary cards and action cards
6. No progress indicators or visual cues for urgency

## Redesign Approach

```text
┌─────────────────────────────────────────────────────────────┐
│  FINANCIAL SNAPSHOT (full-width hero strip)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Revenue  │ │ Payable  │ │ Cash     │ │ Net      │       │
│  │ $117k    │ │ $44k     │ │ $25k     │ │ $98k     │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  ACTION REQUIRED (alerts strip, only when items exist)      │
│  🔴 27 overdue invoices ($117k)  🟡 18 overdue bills ($16k)│
├──────────────────────────┬──────────────────────────────────┤
│  RECEIVABLES (wider)     │  PAYABLES                        │
│  Invoices breakdown      │  Bills breakdown                 │
│  - Total / Unpaid / Late │  - Open / Overdue                │
│  - Due date bar chart    │  - Due date bar chart            │
│  [+ New Invoice]         │                                  │
├──────────────────────────┴──────────────────────────────────┤
│  BANKING ACTIVITY (collapsible, same as now)                │
├────────────────────────────┬────────────────────────────────┤
│  CASH & PAYMENTS           │  PENNY'S QUEUE                 │
│  Total collected           │  Pending / AR at risk           │
│  [+ New Transaction]       │  [Review Actions]               │
└────────────────────────────┴────────────────────────────────┘
```

## Specific Changes

### 1. New Financial Snapshot Strip (top of dashboard)

Add a full-width row of 4 metric tiles above everything else:
- **Receivable** -- total outstanding AR (from `totalReceivable`)
- **Payable** -- total outstanding AP (from `totalPayable`)
- **Cash Position** -- sum of bank account balances
- **Net Position** -- Receivable - Payable (color-coded green/red)

Each tile: large number, small label, subtle icon. No card border -- uses a light background strip to separate from the cards below.

### 2. Alerts Banner

A conditional banner that only appears when overdue items exist. Shows overdue invoices and overdue bills counts with amounts in a compact horizontal strip using destructive/warning colors. Clicking navigates to the relevant tab.

### 3. Improved Invoices & Bills Cards

- Increase card padding and font sizes for readability
- Add a subtle progress ring or percentage indicator showing "% collected" for invoices
- Make the mini bar chart taller (from 48px to 64px) with better labels
- Add a colored left border to indicate health (green = mostly current, red = mostly overdue)

### 4. Merge Cash into a Richer Card

Instead of a near-empty Cash card, combine it with a "Recent Payments" mini-list showing the last 3 payments with dates and amounts. This gives immediate context.

### 5. Improved Penny's Queue Card

- Add a colored progress bar showing pending vs. completed approvals
- Make the badge more prominent
- Add a one-line summary like "3 items need attention today"

### 6. Better Grid Layout

Change from `grid-cols-1 md:grid-cols-2 xl:grid-cols-4` to:
- Snapshot strip: `grid-cols-2 md:grid-cols-4` (full width)
- Main cards: `grid-cols-1 md:grid-cols-2` (Invoices and Bills side by side, equal width)
- Banking: `col-span-full` (unchanged)
- Bottom row: `grid-cols-1 md:grid-cols-2` (Cash + Penny side by side)

## Files Modified

| File | Change |
|---|---|
| `src/components/accounting/AccountingDashboard.tsx` | Full rewrite of layout, add FinancialSnapshot and AlertsBanner components, update card designs |

## What Stays the Same

- `BankAccountsCard.tsx` -- untouched, already well-designed
- All data hooks and props -- no API changes
- Navigation behavior -- all click handlers preserved
- Dark/light theme compatibility -- uses existing CSS variables

