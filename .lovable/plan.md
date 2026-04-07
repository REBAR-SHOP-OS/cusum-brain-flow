

# Enforce QB Sync + PDF Attachment with Dual Payment Links on Every Invoice

## Problem

Currently:
1. **QB push only at email-send time** — invoices created in the ERP have no QB copy until the user clicks "Send Email." If they just save or print, QB never gets the invoice.
2. **No PDF attachment** — the email sends inline HTML with line items and payment buttons, but no actual PDF file is attached. The user wants a proper PDF invoice attached to the email.
3. **Payment links are inline HTML buttons** — these work, but should also appear in the PDF itself so the recipient has them regardless of email client rendering.

## Plan

### 1. Auto-push to QuickBooks on Save (`DraftInvoiceEditor.tsx`)

In `handleSave`, after successfully saving to the local DB, automatically call `quickbooks-oauth` with `action: "create-invoice"` to ensure every saved invoice has a QB mirror. Store the returned `InvoiceLink` and QB invoice ID in the `sales_invoices.metadata` field for later use.

- If QB is not connected, log a warning but don't block the save.
- Skip the QB push if the invoice already has a `metadata.qb_invoice_id` (update instead of create — or just skip since QB deduplication handles it).

### 2. Generate PDF via Edge Function (`generate-invoice-pdf`)

Create a new edge function `generate-invoice-pdf` that:
- Accepts invoice data (line items, customer info, amounts, payment links)
- Renders a professional PDF using the same layout as the print view
- Embeds both Stripe and QuickBooks payment links as clickable URLs in the PDF footer
- Returns the PDF as base64

Technology: Use `jspdf` (available in Deno) or build HTML and convert via a lightweight approach. Since we can't attach files via Lovable's email system directly, we'll use the **download link workaround**:
- Generate the PDF in the edge function
- Upload it to Supabase Storage (`invoice-pdfs` bucket)
- Return a signed URL

### 3. Update Email Flow (`DraftInvoiceEditor.tsx` — `handleSendEmail`)

Modify the send flow to:
1. Generate the PDF by calling `generate-invoice-pdf` with all invoice data + both payment links
2. The edge function uploads to storage and returns a download URL
3. Include a prominent "Download Invoice PDF" button in the email HTML alongside the existing payment link buttons
4. Keep the inline HTML line items table (for email clients that block links)

### 4. Storage Bucket for Invoice PDFs

Database migration to create a `invoice-pdfs` storage bucket (private, signed URLs for access).

### Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Add QB push in `handleSave`; add PDF generation + download link in `handleSendEmail` |
| `supabase/functions/generate-invoice-pdf/index.ts` | **New** — generates PDF from invoice data, uploads to storage, returns signed URL |
| Database migration | Create `invoice-pdfs` storage bucket |

### Technical Notes

- PDF generation uses `jspdf` in the edge function (Deno-compatible)
- The PDF includes: company header, bill-to, line items table, subtotal/tax/total, both payment link URLs as text, and terms/notes
- Since Lovable email doesn't support file attachments natively, the email includes a "Download Invoice PDF" button linking to a signed storage URL (valid 30 days)
- QB sync is idempotent — if called twice for the same invoice, QB handles deduplication via the memo/DocNumber matching

