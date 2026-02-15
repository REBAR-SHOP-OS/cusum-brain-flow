

## Audit Report and Improvement Plan: Agent Penny (Accounting)

### Current Architecture Summary

Penny operates across 4 backend functions and several frontend components:

1. **`ai-agent/index.ts`** (lines 736-853) -- System prompt defining Penny's persona, capabilities, and tools
2. **`penny-auto-actions/index.ts`** -- Scans overdue invoices from `accounting_mirror` and queues collection actions
3. **`penny-execute-action/index.ts`** -- Executes approved collection actions (email, call, escalate)
4. **`generate-suggestions/index.ts`** (lines 264-452) -- Creates proactive suggestions for the Penny dashboard
5. **Frontend**: `AccountingDashboard.tsx`, `AccountingActionQueue.tsx`, `usePennyQueue.ts`

---

### Audit Findings

#### A. Prompt Weaknesses (Critical)

| Issue | Impact | Location |
|-------|--------|----------|
| No morning briefing for Penny | Gauge (estimation) gets a structured briefing on greeting; Penny does not. Accountant starts the day without a prioritized checklist. | `ai-agent/index.ts` ~line 4090 |
| Hardcoded team directory | Extensions and names are static in the prompt. Adding/removing staff requires a code deploy. | Lines 827-836 |
| No QB write operations documented | Prompt says "Create Estimate/Invoice" but there is no tool defined for QB writes -- Penny cannot actually create invoices via tool calling. | Lines 782-783 |
| No Aged Receivables/Payables analysis guidance | Context loads `qbAgedReceivables` and `qbAgedPayables` but the prompt never tells Penny to use them. | Lines 768-780 |
| Missing HST/payroll deadline awareness | Prompt mentions month-end checklist but provides no actual date logic -- Penny cannot proactively flag upcoming CRA deadlines. | Line 764 |

#### B. Context Data Gaps (High)

| Gap | Effect |
|-----|--------|
| No `qbEstimates` loaded | Penny cannot list or convert estimates to invoices despite the prompt claiming she can |
| No credit notes / refunds data | Cannot track or report on credits issued |
| No `penny_collection_queue` history in context | Penny cannot reference past collection actions when advising the user |
| Customer payment velocity not calculated | Penny mentions payment patterns but has no aggregated data to detect trends |
| No work orders / orders context | Cannot flag un-invoiced completed orders (prompt says she should) |

#### C. Auto-Actions Logic Issues (Medium)

| Issue | Location |
|-------|----------|
| `penny-auto-actions` only checks `accounting_mirror` -- if QB sync is stale, overdue invoices are missed | `penny-auto-actions/index.ts` line 22 |
| No deduplication by `customer_id` -- same customer can have 5+ pending actions flooding the queue | Line 51 checks `invoice_id` only |
| Email/call scripts are hardcoded templates, not AI-generated per customer context | Lines 156-198 |
| Escalation threshold (60 days) is hardcoded with no company-configurable override | Line 86 |

#### D. Model Routing (Low)

| Issue | Impact |
|-------|--------|
| Simple queries use `gemini-2.5-flash-lite` which sometimes produces shallow answers for financial data | Line 3208 |
| Complex financial queries use `gemini-3-flash-preview` but should use `gemini-2.5-pro` for precision on AR analysis | Line 3198 |

---

### Improvement Plan

#### 1. Add Morning Briefing for Penny

When Penny detects a greeting ("good morning", "hi", "salam"), inject a structured briefing prompt that covers:

| # | Category | Data Source |
|---|----------|-------------|
| 1 | AR Summary | `qbAgedReceivables` -- totals by aging bucket |
| 2 | Overdue Invoices | `qbInvoices` where `balance > 0` and `dueDate < today` |
| 3 | Payments Received | `qbPayments` filtered to last 7 days |
| 4 | Collection Queue | `penny_collection_queue` pending items |
| 5 | Upcoming Bills | `qbBills` due in next 7 days |
| 6 | Emails Needing Action | `accountingEmails` unread count |
| 7 | Open Tasks | `userTasks` by priority |
| 8 | Compliance Deadlines | Auto-calculated HST/payroll dates |

Model override: `gemini-2.5-pro` with `maxTokens: 5000`, `temperature: 0.2`

**File**: `supabase/functions/ai-agent/index.ts` -- add briefing detection block for `agent === "accounting"` near line 4090

#### 2. Enrich Context Data

Add to `fetchContext` when `agent === "accounting"`:

- **QB Estimates**: Fetch via `SELECT * FROM Estimate WHERE TxnStatus = 'Pending' MAXRESULTS 50`
- **Collection History**: Load last 20 executed items from `penny_collection_queue` (status = "executed" or "failed")
- **Un-invoiced Orders**: Query `orders` where `status = 'completed'` and no linked invoice in `accounting_mirror`
- **Payment Velocity**: Compute average days-to-pay per top 10 customers from `qbPayments` + `qbInvoices`

**File**: `supabase/functions/ai-agent/index.ts` -- expand the `if (agent === "accounting")` block around line 2251

#### 3. Upgrade Prompt with New Context References

Update Penny's system prompt to:

- Document all new context fields (`qbEstimates`, `collectionHistory`, `uninvoicedOrders`, `paymentVelocity`, `qbAgedReceivables`, `qbAgedPayables`)
- Add explicit instructions to use `qbAgedReceivables` for AR aging analysis instead of manually computing from invoices
- Add compliance deadline logic: "Today is {date}. HST filing is due on the {next quarterly date}. T4s are due by Feb 28. Payroll remittance due by the 15th."
- Add payment velocity coaching: "Flag customers whose average days-to-pay has increased by 20%+ vs their 6-month average"

**File**: `supabase/functions/ai-agent/index.ts` -- lines 736-853

#### 4. Add QuickBooks Write Tools

Add two new tools for the accounting agent:

- **`create_qb_invoice`**: Creates a draft invoice in QuickBooks (requires customer ID, line items, due date). Always requires user confirmation.
- **`create_qb_estimate`**: Creates a draft estimate. Same confirmation-first pattern.

Both tools call the existing `quickbooks-oauth` edge function with appropriate action types.

**File**: `supabase/functions/ai-agent/index.ts` -- add to tools array around line 4234

#### 5. Improve Auto-Actions Intelligence

In `penny-auto-actions/index.ts`:

- Add customer-level deduplication: group overdue invoices by `customer_id` and create ONE consolidated action per customer (total amount, list of invoice numbers)
- Replace hardcoded email/call templates with AI-generated drafts using Lovable AI gateway -- personalized per customer relationship history
- Make escalation thresholds configurable via a `penny_config` row in `comms_config` or a new settings table

**File**: `supabase/functions/penny-auto-actions/index.ts`

#### 6. Upgrade Model Routing

Update the `selectModel` function for accounting:

- Simple queries (balance check, single invoice lookup): keep `flash-lite`
- Complex analysis (AR aging, reconciliation, audit, P&L review, briefing): upgrade to `gemini-2.5-pro` instead of `flash-preview`
- Call requests: keep `flash` for structured tag output

**File**: `supabase/functions/ai-agent/index.ts` -- lines 3193-3213

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ai-agent/index.ts` | 1. Expand Penny system prompt with new context references and compliance logic. 2. Add morning briefing detection for accounting agent. 3. Add `create_qb_invoice` and `create_qb_estimate` tools. 4. Enrich `fetchContext` with estimates, collection history, un-invoiced orders, payment velocity. 5. Upgrade model routing for complex accounting queries. |
| `supabase/functions/penny-auto-actions/index.ts` | 1. Add customer-level deduplication. 2. Replace hardcoded templates with AI-generated drafts. 3. Add configurable escalation thresholds. |

### No Database Changes Required

All improvements use existing tables (`penny_collection_queue`, `accounting_mirror`, `orders`, `communications`). No schema modifications needed.

