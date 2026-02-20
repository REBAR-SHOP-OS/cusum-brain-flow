
# Enhance Penny AI with Phase 17 QuickBooks Data

## Summary

Penny currently has extensive QB context (invoices, payments, bills, P&L, balance sheet, aged AR/AP) but does NOT yet leverage the new Phase 17 capabilities: **Cash Flow Statement**, **Tax Summary**, **Bill Payments**, **Classes/Departments**, or the new tables. This plan wires all of that into Penny's brain, adds new tool-calling capabilities, and upgrades the morning briefing.

---

## Track A: Expand `fetchQuickBooksLiveContext` with Phase 17 Reports

Add three new QB API calls inside the existing helper function:

1. **Cash Flow Statement** -- `reports/CashFlow` with current month and prior month for comparison
2. **Tax Summary** -- `reports/TaxSummary` for HST/GST collected vs paid
3. **Bill Payments** -- `SELECT * FROM BillPayment` for vendor payment tracking

Also fetch **Classes** and **Departments** from local `qb_classes` / `qb_departments` tables so Penny can reference project/cost-center data.

New context keys: `qbCashFlow`, `qbTaxSummary`, `qbBillPayments`, `qbClasses`, `qbDepartments`

---

## Track B: New Penny Tools (Tool-Calling)

Give Penny 4 new tool-calling functions so she can take action, not just report:

1. **`fetch_cash_flow_report`** -- Pull native QB cash flow for any date range and present it
2. **`fetch_tax_summary`** -- Pull HST/GST summary for a specific period (for filing prep)
3. **`create_bill_payment`** -- Pay a vendor bill through QB (with user approval gate)
4. **`create_expense`** -- Record a new expense/purchase in QB (with user approval gate)

These tools call the existing `quickbooks-oauth` edge function actions added in Phase 17.

---

## Track C: Upgrade Morning Briefing

Add 3 new sections to Penny's structured morning briefing (currently 8 sections, expanding to 11):

- **Section 9: Cash Flow Snapshot** -- Operating/Investing/Financing from native QB report, month-over-month comparison
- **Section 10: HST/GST Status** -- Tax collected, ITCs claimed, net owing, days until next filing deadline
- **Section 11: Project/Class P&L** -- If classes exist, show top 5 classes by revenue with margin

---

## Track D: Enhanced System Prompt

Update Penny's persona prompt to include:
- Knowledge of cash flow analysis (3-activity breakdown: operating, investing, financing)
- HST/GST filing rules (quarterly deadlines, ITC claiming, net remittance calculation)
- Class/Department-level reporting capabilities
- Bill payment workflow (3-way match reminder before paying)

---

## Technical Details

### Files Modified

**`supabase/functions/ai-agent/index.ts`** (4 areas):

1. **`fetchQuickBooksLiveContext()`** (~line 3098) -- Add 5 new data fetches:
   - QB Cash Flow report via `qbFetch`
   - QB Tax Summary report via `qbFetch`  
   - QB BillPayment query via `qbFetch`
   - `qb_classes` table query
   - `qb_departments` table query

2. **Penny system prompt** (~line 892) -- Add paragraphs on cash flow analysis, HST/GST compliance, class-based reporting

3. **Tools array** (~line 6036) -- Add 4 new tool definitions for accounting agent:
   - `fetch_cash_flow_report` (params: start_date, end_date)
   - `fetch_tax_summary` (params: start_date, end_date)
   - `create_bill_payment` (params: vendor_id, bill_id, amount, payment_method)
   - `create_expense` (params: account_id, vendor_id, amount, description, class_id, department_id)

4. **Tool execution handler** -- Add cases to execute these tools by calling `supabase.functions.invoke("quickbooks-oauth", { body: { action: "...", ... } })`

5. **Morning briefing template** (~line 5588) -- Add sections 9, 10, 11 with context references to `qbCashFlow`, `qbTaxSummary`, `qbClasses`

### No New Files Required

All changes are within the existing `ai-agent/index.ts` edge function.

### No Database Changes Required

Phase 17 already created `qb_classes`, `qb_departments`, and all needed tables.

### Implementation Order

1. Expand `fetchQuickBooksLiveContext` with new data fetches
2. Update Penny's system prompt with new knowledge
3. Add tool definitions to the tools array
4. Add tool execution handlers
5. Upgrade morning briefing template
6. Deploy and test
