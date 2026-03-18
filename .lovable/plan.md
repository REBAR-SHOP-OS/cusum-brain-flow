

## Plan: Auto-Save Quotations Without Approval Step

### Problem
The Blitz agent currently:
1. Generates a quote via `generate_sales_quote`
2. Shows the result and asks "Approve this quotation?"
3. Only saves to `sales_quotations` after user approval

The user wants the agent to **automatically save** immediately after generating — no approval prompt, no PDF preview step.

### Changes

**File: `supabase/functions/_shared/agents/sales.ts`**

Update the quoting instructions (lines 227-229) to remove the approval step:

- **Line 227-229**: Change from "Present table → ask for approval → on approval save" to "Present table → **immediately call `save_sales_quotation`** in the same turn → confirm saved with quotation number"
- Remove the line: `End with: "✅ **Approve this quotation?** I'll save it and can email it to the customer."`
- Replace with: `After presenting the quote table, **immediately** call save_sales_quotation with the line items and total. Do NOT ask for approval first. Report: "✅ Quotation Q20260001 saved. Want me to email it to the customer?"`

### Result
When a customer says "create a quote for this", the Blitz agent will generate the quote AND save it to `sales_quotations` in one step. The quote will immediately appear on the Quotations page. No approval gate.

