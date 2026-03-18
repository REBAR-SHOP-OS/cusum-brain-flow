

## Plan: Convert Approved Quotation → Invoice + Payment Link Email

### What This Adds
After a customer receives a quotation email and the salesperson confirms approval in Blitz chat, the agent will:
1. Convert the quotation to a sales invoice (`sales_invoices` table)
2. Generate a Stripe payment link for the invoice amount
3. Send a professional branded invoice email with the payment link embedded
4. Update the quotation status to `approved`

### Changes

**1. `supabase/functions/_shared/agentTools.ts` — Add `convert_quotation_to_invoice` tool**
- Available to `sales` and `commander` agents (alongside existing quotation tools)
- Parameters: `quotation_id` (required), `customer_email` (required), `due_date` (optional, default 30 days)
- Description: Converts an approved quotation to a sales invoice, generates a Stripe payment link, and sends the invoice email

**2. `supabase/functions/_shared/agentToolExecutor.ts` — Implement `convert_quotation_to_invoice`**
- Fetch the quotation by ID from `sales_quotations`
- Generate invoice number using `INV-{YYYY}{NNNN}` pattern (query `sales_invoices` table)
- Insert into `sales_invoices` with: `quotation_id`, `customer_name`, `customer_company`, `amount`, `status: "sent"`, `issued_date: today`, `due_date`, `notes` (copied from quotation)
- Call `stripe-payment` edge function with `action: "create-payment-link"` to generate a Stripe payment URL
- Build a professional HTML invoice email (same REBAR.SHOP branding as quotation email) with:
  - Invoice number, amount, due date
  - Line items table (parsed from notes)
  - Prominent **"Pay Now"** button linking to the Stripe payment URL
  - Professional signature
- Send via `gmail-send`
- Update quotation status to `approved`
- Return invoice ID, number, and payment link URL

**3. `supabase/functions/_shared/agents/sales.ts` — Update Blitz prompt**
Add to the quotation workflow instructions:
```
## Quotation → Invoice Conversion
When a salesperson says the customer approved the quote (or says "approved", "convert to invoice", "customer accepted"):
1. Call `convert_quotation_to_invoice` with the quotation_id and customer email
2. This automatically creates the invoice, generates a Stripe payment link, and sends a professional invoice email
3. Report: "✅ Invoice INV-20260001 created and sent to customer@example.com with a payment link"
```

### Files to Change
1. `supabase/functions/_shared/agentTools.ts` — add `convert_quotation_to_invoice` tool definition
2. `supabase/functions/_shared/agentToolExecutor.ts` — implement the full conversion + Stripe + email logic
3. `supabase/functions/_shared/agents/sales.ts` — add prompt instructions for the approval→invoice flow

