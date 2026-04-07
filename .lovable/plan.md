

# Full Audit: Penny Agent + QuickBooks Integration — Findings & Optimization Plan

## Audit Summary

Penny is the accounting agent responsible for AR collections, overdue invoice management, email/call drafting, and QB financial reporting. After reviewing all Penny-related code (penny-auto-actions, penny-execute-action, auto-approve-penny, admin-chat QB tools, agentConfigs, usePennyQueue, vizzyFullContext, vizzyIdentity), and cross-referencing with the official QB Online Accounting API and QB Payments API documentation, here are the findings.

---

## What Works Well
- Collection queue with tiered escalation (email → call → re-send → escalate)
- AI-drafted emails and call scripts with fallback templates
- Auto-approve automation for low-risk items (<$5K, >30 days)
- Auto-resolve paid invoices from queue
- Consolidated per-customer actions (not per-invoice)
- QB sync before scanning ensures fresh data
- 9 report types available via fetch_qb_report tool
- GL anomaly detection (round numbers, imbalanced entries)

---

## Critical Findings & Fixes

### 1. QB Payments API Completely Unused
The QB Payments API (charges, refunds, bank accounts, e-checks) is not integrated at all. Penny cannot:
- Check payment status on invoices
- Process credit card charges against invoices
- Issue refunds
- Accept e-check/ACH payments

**Fix**: Add `fetch_qb_payment_status` and `record_qb_payment` tools to admin-chat JARVIS_TOOLS, with backend handlers in quickbooks-oauth that call the QB Payments API endpoints.

### 2. Penny Has No Direct Chat Tools
Unlike Vizzy (admin-chat) which has 40+ tools, Penny as an agent in the AgentDataPanel has zero dedicated tools. The accounting agent config in `agentConfigs.ts` lists capabilities like "Check overdue invoices" and "QuickBooks sync" but these are just labels — the agent chat doesn't route to any tool executor. Penny's chat goes through the same admin-chat endpoint as Vizzy, meaning Penny IS Vizzy when chatting.

**Fix**: This is actually correct architecture — Penny's automated actions run via penny-auto-actions (scan + queue) and penny-execute-action (execute). The chat interface correctly routes through Vizzy who has all the QB tools. No change needed, but the agent greeting should be more specific.

### 3. Missing QB Report Types in Penny's Toolset
QB API supports several reports Penny doesn't expose:
- **CustomerBalance** / **CustomerBalanceDetail** — critical for AR by customer
- **VendorBalance** / **VendorBalanceDetail** — AP by vendor
- **APAgingSummary / APAgingDetail** — proper aging buckets
- **ARAgingSummary / ARAgingDetail** — proper aging buckets (vs generic AgedReceivables)
- **CustomerIncome** — revenue by customer

**Fix**: Add these report types to `fetch_qb_report` enum and the `reportTypeToAction` map in admin-chat, plus corresponding handlers in quickbooks-oauth.

### 4. Penny Auto-Actions Use Stale AI Model
`penny-auto-actions` line 289 uses `gpt-4o-mini` for email drafts and call scripts. This should use the Lovable AI gateway supported models instead.

**Fix**: Change to `gemini-2.5-flash` via the existing `callAI` router (already imported).

### 5. No Payment Receipt Tracking in Collection Queue
When Penny sends a collection email or schedules a call, there's no mechanism to check if the customer actually paid between the action being queued and executed. The auto-clean only runs during `penny-auto-actions` scan, not on `penny-execute-action`.

**Fix**: Add a payment check at the top of `penny-execute-action` before executing — if the invoice balance is now $0, auto-resolve and skip execution.

### 6. Missing Customer Statement Capability
QB API supports sending customer statements (summary of all open invoices) via the Statement entity. Penny should offer this as an action type for customers with multiple overdue invoices.

**Fix**: Add `send_statement` action type to penny-auto-actions for customers with 3+ overdue invoices, and implement the QB Statement API call in quickbooks-oauth.

### 7. No Deposit/Payment Matching
Penny can see overdue invoices but has no tool to match incoming deposits or payments to invoices. QB's Payment entity allows recording received payments against specific invoices.

**Fix**: Add a `record_payment` tool to admin-chat that calls `receive-payment` action in quickbooks-oauth, allowing Vizzy/Penny to record payments directly.

---

## Implementation Plan

### File: `supabase/functions/penny-auto-actions/index.ts`
- Change AI model from `gpt-4o-mini` to `gemini-2.5-flash` (lines 289, 319)
- Add `send_statement` action type for customers with 3+ overdue invoices
- Add payment receipt check with `receive-payment` tool awareness in reasoning

### File: `supabase/functions/penny-execute-action/index.ts`
- Add pre-execution payment check (lines 14-24): query accounting_mirror for current balance before executing
- If balance ≤ 0, auto-resolve the queue item and skip execution
- Add `send_statement` case that calls QB Statement API

### File: `supabase/functions/admin-chat/index.ts`
- Add new report types to `fetch_qb_report` enum: `CustomerBalance`, `CustomerBalanceDetail`, `VendorBalance`, `ARAgingSummary`, `APAgingSummary`, `CustomerIncome`
- Add `record_payment` tool to JARVIS_TOOLS for recording received payments
- Add `record_payment` to WRITE_TOOLS set
- Implement `record_payment` handler in executeWriteTool that calls quickbooks-oauth `receive-payment`

### File: `supabase/functions/quickbooks-oauth/index.ts`
- Add handlers for new report types (CustomerBalance, VendorBalance, ARAgingSummary, APAgingSummary, CustomerIncome)
- Add `send-statement` action handler
- Ensure `receive-payment` action properly records payments against specific invoices

### File: `src/components/agent/agentConfigs.ts`
- Update Penny's capabilities list to reflect actual available features
- Update greeting to be more data-driven

### File: `supabase/functions/_shared/vizzyIdentity.ts`
- Add record_payment and new report types to Vizzy's capability list
- Update the "You CANNOT" section to remove payment processing limitation (since we're adding it)

## Scope
| File | Change |
|------|--------|
| `supabase/functions/penny-auto-actions/index.ts` | Fix AI model, add statement action, payment-aware reasoning |
| `supabase/functions/penny-execute-action/index.ts` | Pre-execution payment check, send_statement handler |
| `supabase/functions/admin-chat/index.ts` | New report types, record_payment tool |
| `supabase/functions/quickbooks-oauth/index.ts` | New report handlers, send-statement action |
| `src/components/agent/agentConfigs.ts` | Update Penny capabilities |
| `supabase/functions/_shared/vizzyIdentity.ts` | Update capability list |

