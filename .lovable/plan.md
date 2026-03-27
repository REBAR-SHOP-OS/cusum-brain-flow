

# Unify Blitz Agent with Quotation/Invoice System

## Problem
Blitz (Sales agent) has its own quotation and invoice tools (`save_sales_quotation`, `send_quotation_email`, `convert_quotation_to_invoice`) that are **disconnected** from the unified document system (DraftQuotationEditor / DraftInvoiceEditor). Specifically:

1. **`save_sales_quotation`** saves line items as plain text in `notes` — does NOT insert into `sales_quotation_items` table
2. **`save_sales_quotation`** does NOT save `customer_email` (needed for acceptance flow)
3. **`send_quotation_email`** builds a basic email from notes text — does NOT include the "Review & Accept Quote" link that the DraftQuotationEditor sends
4. **`convert_quotation_to_invoice`** creates invoice header but does NOT copy items to `sales_invoice_items` (same $0 invoice bug)
5. Blitz quotation emails don't match the branded format with accept link, line items table, HST breakdown

## Changes

### 1. `supabase/functions/_shared/agentToolExecutor.ts` — Fix `save_sales_quotation`

After inserting the quotation header (line ~1573), also insert line items into `sales_quotation_items`:
- Loop through `args.line_items` and insert each as a row with `quotation_id`, `description`, `quantity`, `unit`, `unit_price`, `total`, `sort_order`
- Add `customer_email` to the tool args schema and save it in `metadata` (for the accept flow to find later)

### 2. `supabase/functions/_shared/agentToolExecutor.ts` — Fix `send_quotation_email`

Replace the basic email builder with a call to the existing `send-quote-email` edge function:
- Instead of building HTML inline, call `send-quote-email` with `action: "send"`, `quotationId`, `customerEmail`, `customerName`
- This reuses the branded email template with Accept Quote button, proper line items table, HST, and validity period
- Falls back to current inline approach if the edge function call fails

### 3. `supabase/functions/_shared/agentToolExecutor.ts` — Fix `convert_quotation_to_invoice`

After creating the invoice header (line ~1749):
- Query `sales_quotation_items` for the quotation's line items
- Insert them into `sales_invoice_items` mapped to the new invoice ID
- This matches the fix already applied in `send-quote-email` for the public accept flow

### 4. `supabase/functions/_shared/agentTools.ts` — Add `customer_email` to `save_sales_quotation`

Add `customer_email` as an optional parameter to the tool definition so Blitz can pass it when saving quotes.

### 5. `supabase/functions/_shared/agents/sales.ts` — Update Blitz prompt

Add instruction: "When saving a quotation, always include `customer_email` if the customer's email is known. This enables the Accept Quote portal and automated invoice emails."

## Technical Flow After Fix

```text
User: "quote 100 15M rebar for john@example.com"
  → Blitz calls generate_sales_quote → gets pricing
  → Blitz calls save_sales_quotation (with customer_email + line_items)
    → Inserts quotation header
    → Inserts line items into sales_quotation_items  ← NEW
    → Saves customer_email in metadata               ← NEW
  → Blitz calls send_quotation_email
    → Calls send-quote-email edge function            ← NEW
    → Customer gets branded email with Accept button  ← NEW
  → Customer clicks Accept
    → accept_and_convert creates invoice + copies items ← ALREADY FIXED
```

## Files Changed
- `supabase/functions/_shared/agentToolExecutor.ts` — save line items to `sales_quotation_items`, use `send-quote-email` for emails, copy items on invoice conversion
- `supabase/functions/_shared/agentTools.ts` — add `customer_email` param to `save_sales_quotation`
- `supabase/functions/_shared/agents/sales.ts` — update Blitz prompt to pass customer_email

