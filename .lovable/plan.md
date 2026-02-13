

# Upgrade QB Audit to Real AI-Powered Analysis

## Problem
The current "AI QuickBooks Audit" is fake -- it uses a `setTimeout` with hardcoded client-side checks. It doesn't leverage AI at all, and the checks are basic (overdue invoices, duplicates, vendor ratio).

## Solution
Replace the fake audit with a real AI-powered audit that sends all QB data to Gemini via an edge function, getting back rich, contextual findings.

## Changes

### 1. New Edge Function: `supabase/functions/qb-audit/index.ts`
- Accepts QB summary data (invoices, bills, payments, accounts, customers, vendors) from the client
- Sends it to Gemini (google/gemini-2.5-flash) with a structured prompt asking for audit findings
- Prompt instructs the AI to analyze: overdue AR/AP, duplicate invoices, cash flow risk, unusual patterns, missing data, collection efficiency, vendor consolidation opportunities, account reconciliation issues
- Returns structured JSON: array of findings with `id`, `type` (error/warning/info/success), `category`, `title`, `description`, and optional `actionLabel`

### 2. Update: `src/components/accounting/AccountingAudit.tsx`
- Replace the `setTimeout` fake audit with a real call to the `qb-audit` edge function
- Send a compressed summary of the QB data (counts, totals, overdue lists, top balances) to keep the payload reasonable
- Display the AI-generated findings using the existing UI (no visual changes needed)
- Add error handling for edge function failures
- Keep the existing quick stats cards unchanged

### Technical Details

**Edge function prompt strategy:**
- Send aggregated data, not raw records (e.g., "5 overdue invoices totaling $42,000" plus the top 10 details)
- Ask for structured JSON output with the exact `AuditItem` shape
- Include company context: total AR, total AP, bank balances, customer/vendor counts

**Payload shape sent to edge function:**
```text
{
  summary: { totalAR, totalAP, invoiceCount, billCount, ... },
  overdueInvoices: [top 20 with customer, amount, days overdue],
  overdueBills: [top 20],
  bankAccounts: [name, balance],
  recentPayments: [top 10],
  possibleDuplicates: [pre-detected client-side],
  dormantCustomers: [count + top 5 names]
}
```

**Response shape:**
```text
{ findings: AuditItem[] }
```

This keeps the existing UI intact while replacing the fake logic with genuine AI analysis.
