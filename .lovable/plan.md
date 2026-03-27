

# Fix: Invoice Line Items, QB Link, and Email Delivery

## Root Causes Found (from logs + code + DB)

### CRITICAL 1: `sales_invoice_items` RLS policies use wrong column
**Table:** `sales_invoice_items`
**Bug:** SELECT/UPDATE/DELETE policies check `profiles.id = auth.uid()` instead of `profiles.user_id = auth.uid()`. Since `profiles.id` is the table's own UUID primary key (not the auth user ID), the condition NEVER matches. Result: the editor reads 0 items, falls back to "Invoice total" with qty=1.

The edge function (service role) correctly inserts 2 items ("Copied 2 line items from quotes.metadata" confirmed in logs), but the **client-side editor can never read them back**.

### CRITICAL 2: `metaItems` variable scoping error
**File:** `send-quote-email/index.ts`
**Bug:** `metaItems` is declared with `const` inside a `try` block (line 636), then referenced in a separate `try` block (line 715) for QB push. JavaScript block scoping makes it undefined there. Confirmed by runtime error: `ReferenceError: metaItems is not defined`.

### CRITICAL 3: Gmail token expired
**Log:** `invalid_grant: Bad Request` — The Gmail refresh token stored in `user_gmail_tokens` is revoked or expired. This is why the customer never receives the invoice email. This is a data/config issue, not a code bug — user needs to re-authenticate Gmail.

### HIGH 4: `InvoiceLink` always null in `accounting_mirror`
All mirrored QB invoices have `InvoiceLink: null`. QuickBooks only returns `InvoiceLink` for invoices created via the API when the company has QuickBooks Payments enabled. If QB Payments is not set up on the QuickBooks company, this field will always be null — no code fix possible.

## Fixes

### Fix 1: RLS policy on `sales_invoice_items` (database migration)
```sql
DROP POLICY "Users can view own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can view own company invoice items" ON sales_invoice_items
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY "Users can update own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can update own company invoice items" ON sales_invoice_items
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY "Users can delete own company invoice items" ON sales_invoice_items;
CREATE POLICY "Users can delete own company invoice items" ON sales_invoice_items
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
```

### Fix 2: Move `metaItems` declaration outside try block
**File:** `supabase/functions/send-quote-email/index.ts`

Move `const metaItems = (meta.line_items || meta.items || []) as any[];` from inside the line-item-copy try block to BEFORE it (alongside `invoiceId`, `invoiceNumber`). This makes it accessible to both the item copy block AND the QB push block.

Same fix needed in the `convert_to_invoice` action where `metaItems` is redeclared at line 396 inside the QB try block — it should use the one declared at line 322.

### Fix 3: Surface Gmail re-auth requirement
The Gmail token is expired. Notify the user they need to re-authenticate their Gmail connection. No code change — operational action.

## Files Changed
- **Database migration** — fix 3 RLS policies on `sales_invoice_items` (`profiles.id` → `profiles.user_id`)
- **`supabase/functions/send-quote-email/index.ts`** — move `metaItems` to shared scope in both `accept_and_convert` and `convert_to_invoice` actions

## Expected Result
- Invoice editor loads the correct 2 line items (not "Invoice total")
- QB invoice push succeeds (no more `metaItems is not defined`)
- Email delivery requires Gmail re-authentication (user action)
