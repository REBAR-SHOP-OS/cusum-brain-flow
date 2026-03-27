

# Unify Create Customer + Add Email to Quote Flow

## Problem
1. The "Create customer" form in the quotation editor only has Name and Address — no email field
2. Customer email is never saved in quote metadata (`customer_email`)
3. When a customer clicks "Accept Quote", the backend fails with "No customer email found for this quotation" because there's no email stored anywhere

## Changes

### 1. `src/components/accounting/documents/DraftQuotationEditor.tsx`

**Add email to create-customer form:**
- Add `newCustEmail` state variable
- Add email input field between name and address in the inline create form
- When creating via `customers` table insert, include `email` field
- After creating, also store the email in component state

**Add email to customer selection:**
- Fetch `email` alongside `customer_id, display_name, company_name` from `v_customers_clean`
- Update `CustomerOption` interface to include `email?: string | null`
- When a customer is selected, auto-populate `customerEmail` state from the customer record

**Save email in quote metadata:**
- Add `customer_email` to the metadata object in `handleSave`
- This ensures the `accept_and_convert` action can resolve the email from `meta.customer_email`

**Auto-fill send dialog:**
- When opening the email dialog, pre-fill `customerEmail` from the stored value

### 2. `supabase/functions/send-quote-email/index.ts`

**Store email on send_quote action:**
- When `send_quote` succeeds, also write `customer_email` into the quote's metadata so it persists for the accept flow
- This is already partially done via `sales_quotations.customer_email` but `accept_and_convert` also checks `meta.customer_email`

### 3. `supabase/functions/quote-public-view/index.ts`

- No changes needed — it already reads from the quote record

## Flow After Fix
```text
1. User creates/selects customer → email auto-populated
2. User saves quote → metadata includes customer_email
3. User sends quote → email stored in both sales_quotations and metadata
4. Customer clicks Accept → backend resolves email from metadata ✓
5. Invoice email sent successfully ✓
```

## Files Changed
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — add email field to create form, auto-populate email on customer select, save email in metadata
- `supabase/functions/send-quote-email/index.ts` — persist customer_email in quote metadata on send

