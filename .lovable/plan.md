
# Fix: Penny Has No QB Data — Full Connection Repair

## Root Cause (Confirmed)

Three compounding failures prevent Penny from accessing QuickBooks data:

**Problem 1 — `fetchQuickBooksLiveContext` is never called**
In `ai-agent/index.ts`, the function is imported on line 2 but never invoked anywhere in the 335-line file. The accounting context block in `fetchContext()` only loads `accounting_mirror` (a secondary mirror table), not the actual `qb_transactions`, `qb_customers`, or `qb_accounts` tables.

**Problem 2 — `fetchQuickBooksLiveContext` body is empty**
The function at line 274 of `agentContext.ts` contains only a comment: `// Logic from original file to fetch live QB data`. It returns nothing. Even if called, it would inject nothing.

**Problem 3 — Penny's prompt references undefined context keys**
The accounting prompt says: "For monthly financial reports: Use qbProfitAndLoss data" — but `qbProfitAndLoss`, `qbInvoices`, `qbCustomers` are never populated. When Penny looks for them and finds nothing, the QA layer flags this and the model correctly (but unhelpfully) says "I cannot fulfill this request."

**The database has all the data:**
- 1,827 Invoices, $4.6M total
- 1,843 Payments, $4.3M total
- 461 Bills, $3.2M total
- Open AR invoices with customer names, amounts, due dates — all in `qb_transactions`

---

## Fix Plan

### Step 1 — Implement `fetchQuickBooksLiveContext` in `agentContext.ts`

Fill in the empty stub to query:
- `qb_transactions` — open invoices (balance > 0), recent bills, recent payments
- `qb_customers` — customer balances and contacts
- `qb_accounts` — chart of accounts snapshot
- `qb_bank_activity` — current bank balances
- `qb_vendors` — vendor list for AP context

Returns a structured object with: `qbInvoices`, `qbCustomers`, `qbAccounts`, `qbBankActivity`, `qbVendors`, `qbSummary` (totals for AR, AP, open invoices count).

### Step 2 — Call it from `ai-agent/index.ts` for accounting agents

After the `fetchContext()` call (line 70), add:
```typescript
if (agent === "accounting" || agent === "collections") {
  const qbLiveData = await fetchQuickBooksLiveContext(svcClient, companyId);
  Object.assign(mergedContext, qbLiveData);
}
```

This injects the live QB context into `mergedContext`, which flows into `contextStr` and is injected into Penny's system prompt — exactly where her instructions expect `qbInvoices` etc. to appear.

### Step 3 — Add 3 QB Action Tools for Penny in `agentTools.ts`

Add these tools to the accounting agent:
- `fetch_qb_report` — fetch live P&L, AR Aging, Balance Sheet, or Cash Flow report from QuickBooks via `quickbooks-oauth` edge function
- `fetch_gl_anomalies` — query `gl_transactions` + `gl_lines` for unusual patterns (round numbers, single-sided entries, missing contra-entries)
- `trigger_qb_sync` — call `qb-sync-engine` to trigger an incremental sync on demand

### Step 4 — Wire tool handlers in `agentToolExecutor.ts`

Add handlers for each new tool:
- `fetch_qb_report`: calls `quickbooks-oauth` with `action: "report"` and the report type
- `fetch_gl_anomalies`: runs a direct query on `gl_transactions`/`gl_lines`, returns top anomalies
- `trigger_qb_sync`: calls `qb-sync-engine` edge function with `mode: "incremental"`

---

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/_shared/agentContext.ts` | Implement `fetchQuickBooksLiveContext` body — query `qb_transactions`, `qb_customers`, `qb_accounts`, `qb_bank_activity`, `qb_vendors` |
| `supabase/functions/ai-agent/index.ts` | Call `fetchQuickBooksLiveContext` for accounting/collections agents after `fetchContext()` |
| `supabase/functions/_shared/agentTools.ts` | Add `fetch_qb_report`, `fetch_gl_anomalies`, `trigger_qb_sync` tools for accounting agent |
| `supabase/functions/_shared/agentToolExecutor.ts` | Add handlers for the 3 new QB tools |

---

## What Changes After This Fix

**Before:** Penny says "I cannot fulfill this request. I do not have access to Profit and Loss statements."

**After:** Penny sees all QB data and can:
- Answer "P&L Dec 2025" → reads from `qbProfitAndLoss` context (or calls `fetch_qb_report`)  
- Answer "Outstanding invoices" → reads `qbInvoices` (1,827 real invoices in DB)
- Answer "What should I do today?" → sees AR aging, overdue balances, upcoming bills
- Pull live reports mid-conversation using `fetch_qb_report` tool
- Trigger a QB sync from chat using `trigger_qb_sync`

---

## Integration Health Summary (Current State)

| Integration | Send | Receive | Status |
|---|---|---|---|
| Odoo CRM Sync | — | 103 leads/24h | Healthy |
| Odoo File Migration | — | Blocked (15,260 pending) | Broken — bad IDs |
| QuickBooks Sync | Yes | Yes (1,827 invoices) | Healthy |
| Penny QB Context | — | — | Broken — empty stub |
| QB Audit AI | Yes | Yes | Working (now on Gemini Pro) |
| Vizzy Daily Brief | Yes | Yes | Working (now on Gemini Pro) |
| Penny Collection Drafts | Yes | Yes | Fixed (now on Gemini Flash) |
