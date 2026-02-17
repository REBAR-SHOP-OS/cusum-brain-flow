

# Upgrade Customer Form to QB-Style + Invoice & Contact Info Improvements

## Problem Summary

From the screenshots and annotations:

1. **Customer "Add Customer" form is too basic** -- only has 7 fields (Name, Company, Type, Status, Terms, Credit Limit, Notes). QuickBooks has 20+ fields with collapsible sections for Name/Contact, Address, and Additional Info.
2. **Invoice list missing Balance column** -- the table shows Total but not the outstanding Balance, making it hard to see what's owed at a glance.
3. **Invoice tax label** still says "Tax:" instead of "HST (ON) 13%:".
4. **Customer detail transactions not clickable** -- you annotated "not able to view invoices in customer accts" -- clicking an invoice row in the customer detail doesn't open the invoice editor.
5. **Customer edit saves but UI doesn't refresh** -- cache invalidation keys are missing (the bug from earlier plan still needs fixing).

---

## Fix 1: Database -- Add Contact & Address Columns to `customers` Table

The `customers` table currently only has: name, company_name, customer_type, status, quickbooks_id, credit_limit, payment_terms, notes, company_id.

Add these columns to match QuickBooks fields:

| Column | Type | Purpose |
|--------|------|---------|
| title | text | Mr./Mrs./etc. |
| first_name | text | First name |
| middle_name | text | Middle name |
| last_name | text | Last name |
| suffix | text | Jr./Sr./etc. |
| email | text | Primary email |
| phone | text | Primary phone |
| mobile | text | Mobile number |
| fax | text | Fax number |
| website | text | Website URL |
| other_phone | text | Other phone |
| print_on_check_name | text | Name for cheques |
| billing_street1 | text | Billing street line 1 |
| billing_street2 | text | Billing street line 2 |
| billing_city | text | Billing city |
| billing_province | text | Billing province |
| billing_postal_code | text | Billing postal code |
| billing_country | text | Default "Canada" |
| shipping_street1 | text | Shipping street line 1 |
| shipping_street2 | text | Shipping street line 2 |
| shipping_city | text | Shipping city |
| shipping_province | text | Shipping province |
| shipping_postal_code | text | Shipping postal code |
| shipping_country | text | Default "Canada" |

All nullable, no breaking changes.

---

## Fix 2: Redesign `CustomerFormModal.tsx` to Match QuickBooks

Replace the simple 7-field dialog with a full QB-style form using collapsible sections (same pattern already used by `AddVendorDialog.tsx`):

**Section 1: Name and Contact** (open by default)
- Company name + Display name (required)
- Title, First name, Middle name, Last name, Suffix (5-column grid)
- Email, Phone
- Mobile, Fax
- Other phone, Website
- Name to print on cheques

**Section 2: Address** (collapsed by default)
- Billing Address: Street 1, Street 2, City, Province, Postal Code, Country
- Shipping Address: Street 1, Street 2, City, Province, Postal Code, Country
- "Same as billing" checkbox

**Section 3: Additional Info** (collapsed by default)
- Type (Business/Individual), Status (Active/Inactive/Prospect)
- Payment Terms, Credit Limit
- Notes

Dialog size increased to `max-w-2xl` to accommodate the wider layout.

---

## Fix 3: Invoice Tax Label

**File: `src/components/accounting/InvoiceEditor.tsx`** (line 408)

Change `"Tax:"` to `"HST (ON) 13%:"`.

---

## Fix 4: Make Customer Detail Transactions Clickable

**File: `src/components/customers/CustomerDetail.tsx`**

Currently, the transaction table rows in the Customer Detail sheet are not clickable. Add an `onClick` handler to each invoice row that opens the `InvoiceEditor` overlay (or navigates to the Accounting Invoices tab with that invoice pre-selected).

Since the Customer Detail doesn't have access to the QB invoice data needed by `InvoiceEditor`, the simplest approach is to make the doc number a clickable link that navigates to `/accounting?tab=invoices&search={docNumber}`, which will filter the invoice list to that specific invoice.

---

## Fix 5: Cache Invalidation for Customer Edits

**File: `src/components/customers/CustomerFormModal.tsx`** (line 141)
Add: `queryClient.invalidateQueries({ queryKey: ["local_customer_by_qb"] })`

**File: `src/components/customers/CustomerDetail.tsx`** (line 915)
Add: `queryClient.invalidateQueries({ queryKey: ["local_customer_by_qb"] })`

---

## Summary of All Changes

| File | Change |
|------|--------|
| Database migration | Add 24 contact/address columns to `customers` table |
| `CustomerFormModal.tsx` | Full QB-style form with collapsible Name/Contact, Address, Additional Info sections |
| `InvoiceEditor.tsx` line 408 | "Tax:" changed to "HST (ON) 13%:" |
| `CustomerDetail.tsx` transactions | Make invoice doc numbers clickable (link to accounting invoices) |
| `CustomerFormModal.tsx` line 141 | Fix cache invalidation |
| `CustomerDetail.tsx` line 915 | Fix cache invalidation |

