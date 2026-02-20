
# QuickBooks × AI — Full Opportunity Audit

## What You Have Today (Current State)

After deep-reading every QB and AI function in the codebase, here is the complete current capability map:

```text
QuickBooks → ERP Data Flow
QB OAuth ──► qb-sync-engine ──► qb_transactions / qb_accounts / qb_customers / qb_vendors
                              ──► gl_transactions / gl_lines (General Ledger)
                              ──► qb_bank_activity (banking)
                              ──► trial_balance_checks (reconciliation)

AI Functions Currently Active on QB Data
qb-audit       → Gemini 2.5 Flash: AI forensic audit of invoices/AR/AP/vendors
penny-auto-actions → Gemini: AI collections email + call scripts for overdue invoices
auto-reconcile → Rule-based matching (NO AI - pure math)
vizzy-daily-brief  → Gemini 2.5 Flash: QB numbers in CEO briefing
accounting agent (Penny) → Gemini 2.5 Pro: Full AI accountant, reads live QB context
```

---

## 9 Gaps & AI Opportunities Found

### GAP 1 — `qb-audit` Uses Flash Instead of Pro (Weak Findings)

The AI forensic audit (`qb-audit`) sends the full financial payload to `gemini-2.5-flash` — the fast/cheap model. For a forensic audit looking for fraud, duplicates, and cash flow gaps, this means the findings are shallow and miss patterns that `gemini-2.5-pro` would catch.

**Fix:** Upgrade `qb-audit` from `gemini-2.5-flash` → `gemini-2.5-pro` with 8000 tokens and lower temperature (0.1 for precision).

---

### GAP 2 — `auto-reconcile` Has Zero AI (Pure Rule-Based)

The `auto-reconcile` function matches transactions by exact amount/date/customer only. It generates human tasks for anything below 100% confidence — but those tasks sit in a queue. No AI looks at the ambiguous matches to make an intelligent recommendation.

**Fix:** Add a `callAI` step that takes the sub-100% confidence matches and provides a natural-language explanation of WHY it's a likely match (e.g., "Customer ABC paid $12,400.00 on 2025-01-18 — this matches Invoice #1042 ($12,400.00, due 2025-01-15) with a 3-day delay, consistent with their Net-15 payment history").

---

### GAP 3 — `penny-auto-actions` Still Hardcodes GPT-4o-mini (Will Fail)

In `penny-auto-actions/index.ts` lines 249 and 281, the AI draft generation explicitly requests `provider: "gpt"` and `model: "gpt-4o-mini"`. With OpenAI quota exhausted, every collection email draft silently fails and falls back to the template. Penny is writing generic letters instead of AI-personalized ones.

**Fix:** Switch both `generateAIDraft` and `generateAICallScript` to `provider: "gemini", model: "gemini-2.5-flash"`.

---

### GAP 4 — No AI on the GL / Journal Entry Layer

The General Ledger (`gl_transactions` + `gl_lines`) is fully populated from every sync. But no AI ever reads it for pattern detection. Penny has no tool to run GL analysis.

**Opportunity:** Add a `fetch_gl_anomalies` tool to Penny's agent that queries `gl_lines` grouped by account and uses Gemini to flag: unusual debit/credit patterns, missing contra-entries, accounts with single-sided entries (potential errors), and large round-number postings.

---

### GAP 5 — `vizzy-daily-brief` Uses Flash (Not Pro) for QB Section

The daily briefing (`vizzy-daily-brief`) uses `gemini-2.5-flash`. When the context includes large QB data, the flash model summarizes too aggressively and misses urgent items (e.g., a $120K overdue invoice buried in 200 AR rows).

**Fix:** Upgrade `vizzy-daily-brief` to `gemini-2.5-pro` with 8000 tokens so the full QB context is properly analyzed.

---

### GAP 6 — No Predictive Cash Flow AI

The system has all ingredients for cash flow prediction — QB invoices (due dates, amounts, customer payment history), QB bills (AP due dates), and bank balances. But there's no AI that synthesizes these into a 30/60/90-day cash flow forecast.

**Opportunity:** New edge function `qb-cashflow-forecast` that:
1. Reads `qb_transactions` (open invoices, bills) + `qb_bank_activity` (current balances)
2. Calls Gemini Pro to generate a 90-day cash flow projection with explicit assumptions
3. Surfaces this in the accounting page and in Penny's morning briefing

---

### GAP 7 — No AI Vendor Spend Intelligence

The system syncs vendors and bills perfectly. But there's no AI analysis of vendor spend concentration, duplicate vendor risk, or opportunistic early-payment discount identification.

**Opportunity:** New `qb-vendor-intelligence` edge function that analyzes `qb_vendors` + `qb_transactions` (Bills) and identifies: top-5 vendor concentration risk, bills eligible for early-pay discount, duplicate vendors (same company different names), and vendors with growing invoice amounts (potential pricing creep).

---

### GAP 8 — Penny Missing Live QB Tools in Agent Loop

Looking at `agentTools.ts`, Penny has `create_notifications` and `send_email` — but NO tools to:
- Fetch live QB data (only context snapshot at session start)
- Create a QB transaction directly (invoice, payment, bill) from within the chat
- Trigger a sync from within the chat

The `quickbooks-oauth` function has 40+ actions but Penny can't call any of them mid-conversation. This means Penny can identify a problem but cannot act on it without the user leaving the chat.

**Opportunity:** Add QB action tools to Penny's toolset:
- `fetch_qb_report` — call `quickbooks-oauth` for live report data (P&L, AR aging, etc.)
- `create_qb_invoice` — create/update invoice directly from chat (with user confirmation)
- `trigger_qb_sync` — run incremental sync on demand

---

### GAP 9 — `fetchQuickBooksLiveContext` is an Empty Stub

In `agentContext.ts` line 274:
```typescript
export async function fetchQuickBooksLiveContext(svcClient: any, context: any) {
  // Logic from original file to fetch live QB data
}
```
This function is **empty** — it was stripped during a refactor. Any agent or briefing that calls this gets NO live QB data injected. The `ai-agent` imports it but it returns nothing.

**Fix:** Implement `fetchQuickBooksLiveContext` to actually query `qb_transactions`, `qb_bank_activity`, and `trial_balance_checks` and inject them into the agent context.

---

## Implementation Plan

### Batch 1 — Critical Fixes (Breaking Issues)

| File | Change | Impact |
|---|---|---|
| `penny-auto-actions/index.ts` | Switch GPT calls to Gemini | Fixes silent AI draft failures — Penny writes real letters again |
| `_shared/agentContext.ts` | Implement `fetchQuickBooksLiveContext` body | Fixes empty QB context stub |
| `vizzy-daily-brief/index.ts` | Upgrade to `gemini-2.5-pro`, 8000 tokens | Briefing catches all urgent QB items |

### Batch 2 — Quality Upgrades (Models)

| File | Change | Impact |
|---|---|---|
| `qb-audit/index.ts` | Flash → Pro, temp 0.1, 8000 tokens | Forensic audit catches deeper patterns |
| `auto-reconcile/index.ts` | Add AI explanation step for sub-100% matches | Clearer human tasks for Vicky |

### Batch 3 — New AI Capabilities

| New Function | What It Does |
|---|---|
| `qb-cashflow-forecast` | 90-day cash flow prediction from QB invoices + bills + bank balances |
| `qb-vendor-intelligence` | Spend concentration, duplicate vendors, pricing creep detection |

### Batch 4 — Penny Agent QB Tools

| Tool | Action |
|---|---|
| `fetch_qb_report` | Pull live P&L / AR Aging / Trial Balance from within chat |
| `create_qb_invoice` | Create QB invoice from Penny's chat (with approval) |
| `trigger_qb_sync` | Trigger incremental QB sync from Penny's chat |

---

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/penny-auto-actions/index.ts` | Fix provider from GPT → Gemini |
| `supabase/functions/_shared/agentContext.ts` | Implement `fetchQuickBooksLiveContext` |
| `supabase/functions/vizzy-daily-brief/index.ts` | Upgrade to Gemini Pro |
| `supabase/functions/qb-audit/index.ts` | Upgrade to Gemini Pro, temperature 0.1 |
| `supabase/functions/auto-reconcile/index.ts` | Add AI explanation for pending matches |
| `supabase/functions/_shared/agentTools.ts` | Add QB action tools for Penny |
| `supabase/functions/_shared/agentToolExecutor.ts` | Implement QB tool handlers |

## Files to Create

| File | Purpose |
|---|---|
| `supabase/functions/qb-cashflow-forecast/index.ts` | 90-day AI cash flow forecast |
| `supabase/functions/qb-vendor-intelligence/index.ts` | Vendor spend analysis AI |

---

## Why These Changes Matter

Right now, QuickBooks is treated as a **data source** — data flows in and humans read it. With these changes, every QB data point becomes an **AI trigger**:

- Overdue invoice → AI writes the collection email (not a template)
- Ambiguous bank match → AI explains why it's likely correct
- End of day → AI predicts next 90-day cash position
- Vendor bill posted → AI flags if vendor pricing has increased vs. history
- Penny chat → AI can pull live QB reports and create transactions without leaving chat

The foundation (sync engine, GL, reconciliation) is excellent. This plan activates the AI layer on top of it.
