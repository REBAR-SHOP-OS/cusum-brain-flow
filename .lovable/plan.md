

# Add Customer Lookup & Creation to Blitz Sales Agent

## Problem
Blitz currently accepts `customer_name` as a freeform string when saving quotations. It doesn't verify if the customer exists in the database or create new customers. This means quotations aren't linked to actual customer records, and new customers aren't added to the system.

## Changes

### 1. `supabase/functions/_shared/agentTools.ts` — Add two new tools for sales agent

**`search_customers`** — Search the `v_customers_clean` view by name/company (debounced, limit 10). Returns matching customer IDs, names, emails, and companies so Blitz can confirm the right one.

**`create_customer`** — Insert a new row into the `customers` table with name, company, email, phone. Returns the new customer ID. The existing normalization trigger will auto-split "Company, Person" into company + contact records.

### 2. `supabase/functions/_shared/agentToolExecutor.ts` — Implement the two tools

**`search_customers`**: Query `v_customers_clean` with `ilike` on `display_name` and `company_name`, limit 10. Return results array.

**`create_customer`**: Insert into `customers` table with the provided fields. Return the new customer record.

### 3. `supabase/functions/_shared/agents/sales.ts` — Update Blitz prompt

Add instruction block:

- Before saving any quotation, Blitz MUST have a customer name
- If the user hasn't mentioned a customer, ask: "Who is this quote for?"
- Once Blitz has a name, call `search_customers` to check if they exist
- If found, confirm with user and use the existing customer's details (name, email, company)
- If NOT found, ask for email and company name, then call `create_customer` to add them
- Use the customer's email from the search/create result as `customer_email` when saving the quotation

### 4. `supabase/functions/_shared/agentToolExecutor.ts` — Link customer to quotation

Update `save_sales_quotation` to accept an optional `customer_id` parameter and store it in the quotation metadata, enabling future lookups.

## Files Changed
- `supabase/functions/_shared/agentTools.ts` — add `search_customers` and `create_customer` tool definitions
- `supabase/functions/_shared/agentToolExecutor.ts` — implement both tools + add `customer_id` to quotation save
- `supabase/functions/_shared/agents/sales.ts` — add customer lookup instructions to Blitz prompt

