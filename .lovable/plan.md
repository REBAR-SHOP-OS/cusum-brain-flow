

# Quotation Workflow Audit — Issues Found (End-to-End)

## 1. Document Type Tabs Are Empty — No Tabs Visible
**File:** `AccountingDocuments.tsx` line 248
**Issue:** `docTabs` is initialized as an empty array `[]` and never populated. The tab bar renders nothing — users only see "Quotation" view by default because `activeDoc` defaults to `"quotation"`. Invoice, Packing Slip, and Estimation tabs are invisible.
**Fix:** Populate `docTabs` with the four document types and their counts (invoices, quotations, estimates, packing slips).

## 2. Delete Without Confirmation
**File:** `AccountingDocuments.tsx` lines 448-454
**Issue:** Clicking the trash icon immediately deletes the quote from the database with no confirmation dialog. A misclick permanently destroys data.
**Fix:** Add a confirmation dialog (or at minimum `window.confirm`) before executing the delete.

## 3. Status Field Mismatch — `odoo_status` vs `status`
**File:** `useArchivedQuotations.ts` line 33 and `AccountingDocuments.tsx` line 438
**Issue:** The status filter dropdown queries `odoo_status` column, but manually created and AI-generated quotes only set the `status` column (e.g., "draft"). The dropdown values are Odoo-specific ("Draft Quotation", "Sales Order") while internal quotes use different values ("draft", "accepted", "sent"). Filtering by status misses most internal quotes.
**Fix:** Filter on both `status` and `odoo_status` columns, and unify the dropdown to show both Odoo and internal status values.

## 4. Convert-to-Order Only Shows for "Sales Order" Status
**File:** `AccountingDocuments.tsx` line 376-436
**Issue:** The "Convert to Order" button only appears when `odoo_status === "Sales Order"`. But the edge function `convert-quote-to-order` accepts statuses: `approved`, `accepted`, `sent`, `signed`. Internally signed/accepted quotes never show the convert button.
**Fix:** Show the convert button when `status` is in the convertible set OR `odoo_status === "Sales Order"`.

## 5. E-Signature Doesn't Update `odoo_status`
**File:** `ESignatureDialog.tsx` line 119
**Issue:** Signing a quote sets `status: "accepted"` but doesn't update `odoo_status`. The UI badge displays `odoo_status || status` (line 439), so after signing, the badge still shows the old Odoo status instead of "Accepted".
**Fix:** Also set `odoo_status` to a displayable value on sign, or fix the badge to prefer `status` when it's been locally updated.

## 6. Quote-to-Order: `customer_id` Is Often Null
**File:** `convert-quote-to-order/index.ts` line 63
**Issue:** The order is created with `customer_id: quote.customer_id`. But for manually created or AI-generated quotes, `customer_id` on the quotes table is often `null` (customer name is stored in metadata only). This creates orders with no customer link.
**Fix:** Resolve `customer_id` from metadata customer name if `quote.customer_id` is null — look up the customers table by name.

## 7. DraftQuotationEditor Saves `total_amount` with Tax but Displays Subtotal Separately
**File:** `DraftQuotationEditor.tsx` line 323 vs `send-quote-email/index.ts` line 148
**Issue:** The editor saves `total_amount = subtotal + tax`. The email function then reverse-calculates subtotal from `total_amount / (1 + taxRate/100)`. If `tax_rate` is missing from metadata (defaults to 13), the email recalculation matches. But if tax rate was changed and not saved properly, the email shows wrong numbers. Also, the `line_items` in metadata store `unitPrice` (camelCase) but the `QuotationTemplate` and `convert-quote-to-order` expect `unit_price` (snake_case) — the editor handles both (`li.unitPrice ?? li.unit_price`) but the conversion function only checks `line.price_unit || line.unit_price`, missing `unitPrice`.
**Fix:** Normalize line item field names to a single convention on save. Add `unitPrice` to the conversion function's fallback chain.

## 8. Search Only Queries `quote_number` and `salesperson`
**File:** `useArchivedQuotations.ts` line 29
**Issue:** Search doesn't cover customer name (stored in `metadata.customer_name` or `metadata.odoo_customer`). Users searching by customer name get zero results.
**Fix:** Add `salesperson` as a proxy works for Odoo quotes, but for manual quotes the customer name is in metadata — consider adding a `customer_name` denormalized column or extending the search to cover metadata via a database function.

## 9. No Quote Status Transition Enforcement on Client
**File:** `ESignatureDialog.tsx`, `DraftQuotationEditor.tsx`
**Issue:** Any quote can be signed regardless of its current status. A "cancelled" quote can be signed and become "accepted". There's no client-side validation of allowed transitions.
**Fix:** Add status validation before allowing sign/send/convert actions.

## 10. `terms` Not Saved in Metadata on Draft Save
**File:** `DraftQuotationEditor.tsx` lines 327-335
**Issue:** The save function writes `metadata` with `customer_name`, `line_items`, `notes`, etc. but does NOT include `terms` even though `terms` state is loaded and displayed. Terms entered in the editor are lost on save.
**Fix:** Add `terms` to the metadata object in `handleSave`.

## Priority Order for Fixes

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | Doc tabs empty | High | Users can't switch document types |
| 3 | Status mismatch | High | Filtering broken for internal quotes |
| 2 | Delete no confirm | High | Data loss risk |
| 6 | Null customer_id on orders | High | Orders created without customer |
| 4 | Convert button hidden | Medium | Workflow blocked for internal quotes |
| 7 | Field name mismatch (unitPrice) | Medium | Line items lost during conversion |
| 10 | Terms not saved | Medium | Data loss |
| 5 | Badge shows wrong status | Low | Visual confusion |
| 8 | Search limited | Low | UX inconvenience |
| 9 | No status guards | Low | Edge case abuse |

