

# Fix: Send Email Dialog Not Picking Up Contact Email

## Problem
When the user selects a customer in the "Bill To" dropdown and clicks "Send Email", the email field is empty. The current code only checks `v_customers_clean.email` (which maps to `customers.email`). Many customers have their email stored in the `contacts` table (linked via `customer_id`) or in `sales_contacts`, but these are never queried.

## Root Cause
In `DraftQuotationEditor.tsx`, line 212:
```ts
if (c.email) setCustomerEmail(c.email);
```
This only uses the email from the `customers` table. If `customers.email` is null, no fallback lookup happens at selection time.

The fallback on lines 148-161 (during initial load) queries `customers` by name — same empty source.

## Fix

### `src/components/accounting/documents/DraftQuotationEditor.tsx`

**1. Enhance `selectCustomer` (line 208-215)** — after setting the customer, if no email found, query `contacts` table by `customer_id`:

```ts
const selectCustomer = async (c: CustomerOption) => {
  setCustomerName(c.name);
  const addrParts = [c.billing_street1, c.billing_city, c.billing_province, c.billing_postal_code].filter(Boolean);
  if (addrParts.length) setCustomerAddress(addrParts.join(", "));
  setCustomerOpen(false);
  setCustomerSearch("");
  
  if (c.email) {
    setCustomerEmail(c.email);
    return;
  }
  
  // Fallback 1: check contacts table by customer_id
  const { data: contact } = await supabase
    .from("contacts")
    .select("email")
    .eq("customer_id", c.id)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  if (contact?.email) {
    setCustomerEmail(contact.email);
    return;
  }
  
  // Fallback 2: check sales_contacts by company_name or name
  const { data: salesContact } = await supabase
    .from("sales_contacts")
    .select("email")
    .eq("company_id", companyId!)
    .or(`name.ilike.%${c.name}%,company_name.ilike.%${c.name}%`)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  if (salesContact?.email) {
    setCustomerEmail(salesContact.email);
  }
};
```

**2. Enhance initial load fallback (lines 147-162)** — same chain: `customers` → `contacts` → `sales_contacts`.

## File Changed
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — add contact/sales_contacts email fallback in `selectCustomer` and initial load

