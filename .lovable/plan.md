
## Fix: Penny's `fetch_qb_report` Sends Wrong Action Names to QuickBooks

### Root Cause (Confirmed — 2 bugs in the connector)

**Bug 1 — Wrong action name: `"report"` does not exist**

The `fetch_qb_report` tool handler in `agentToolExecutor.ts` (line 372) sends:
```json
{ "action": "report", "report_type": "ProfitAndLoss" }
```

But `quickbooks-oauth/index.ts` switch statement has **no `case "report"`**. It hits the `default` branch and returns:
```json
{ "error": "Unknown action: report" }
```

The real action names are: `"get-profit-loss"`, `"get-balance-sheet"`, `"get-aged-receivables"`, `"get-aged-payables"`, `"get-cash-flow"`, `"get-tax-summary"`.

**Bug 2 — Wrong parameter names**

Even if the action were correct, the parameter names don't match:
- Tool sends `start_date` / `end_date` (snake_case)
- `handleGetProfitLoss` reads `body.startDate` / `body.endDate` (camelCase)
- `handleGetBalanceSheet` reads `body.asOfDate`

**Result:** Every call to `fetch_qb_report` returns `"Unknown action: report"` → tool result is `success: false, error: "Unknown action: report"` → Penny sees the tool failed → QA layer catches it → sanitized reply: *"I was unable to retrieve the Profit and Loss report for 2025 due to a technical issue."*

---

### Fix Plan

**Only 1 file needs to change: `supabase/functions/_shared/agentToolExecutor.ts`**

Replace the `fetch_qb_report` handler (lines 367–388) with a proper router that:

1. Maps `report_type` → correct `quickbooks-oauth` action name:

| `report_type` (Penny sends) | `action` (QB expects) |
|---|---|
| `ProfitAndLoss` | `get-profit-loss` |
| `BalanceSheet` | `get-balance-sheet` |
| `AgedReceivables` | `get-aged-receivables` |
| `AgedPayables` | `get-aged-payables` |
| `CashFlow` | `get-cash-flow` |
| `TaxSummary` | `get-tax-summary` |

2. Sends correct camelCase parameter names to match what each handler reads:
   - P&L: `startDate`, `endDate`
   - Balance Sheet: `asOfDate`
   - Aged reports: `asOfDate`
   - Cash Flow / Tax Summary: `startDate`, `endDate`

3. If `period` is passed (e.g., `"This Year"`, `"Last Month"`), convert it to concrete `start_date` / `end_date` date strings before sending.

---

### Files to Change

| File | Change |
|---|---|
| `supabase/functions/_shared/agentToolExecutor.ts` | Fix `fetch_qb_report` handler: map `report_type` → correct action, fix parameter casing, add period→date conversion |

No other files need to change. The QB handlers are fine. The tools definition is fine. Only the bridge between Penny's tool call and QuickBooks is broken.

---

### After This Fix

- Penny asks for P&L 2025 → calls `fetch_qb_report` with `{ report_type: "ProfitAndLoss", start_date: "2025-01-01", end_date: "2025-12-31" }` → executor maps to `action: "get-profit-loss"` with `{ startDate: "2025-01-01", endDate: "2025-12-31" }` → QB returns real P&L data → Penny summarizes it correctly
- Same fix applies to Balance Sheet, AR Aging, AP Aging, Cash Flow, and Tax Summary
