

# Add "Review & Accept" Link to Quotation PDF/Print Templates

## Problem
When a quotation is printed or exported as PDF (via the browser Print dialog), there is no clickable link for the customer to accept the quote online. The acceptance link (`/accept-quote/{id}`) only exists in the **email** HTML body, not in the on-screen/print quotation templates.

## What Changes

### 1. `src/components/accounting/documents/DraftQuotationEditor.tsx`
Add a prominent "Accept Online" section between the totals and signature area (visible in print):
- A styled box with the full acceptance URL: `https://cusum-brain-flow.lovable.app/accept-quote/{quoteId}`
- Clickable on screen, and printed as visible text so it works on paper PDFs too
- Text: "To accept this quotation online, visit:" followed by the URL

### 2. `src/components/accounting/documents/QuotationTemplate.tsx`
Add the same acceptance link section to the read-only quotation view template:
- Requires adding `quoteId` to the `QuotationData` interface (or passing it as a separate prop)
- Same styled box with the acceptance URL between totals and signature

### 3. `src/components/accounting/AccountingDocuments.tsx`
Pass `quoteId` (the `q.id`) to `QuotationTemplate` when rendering the view overlay, so the template can build the acceptance URL.

## Technical Details

**URL format**: `https://cusum-brain-flow.lovable.app/accept-quote/{quoteId}`

**Print styling**: The link section uses `print:block` and renders the URL as plain text (not just a hyperlink) so it remains readable on physical paper.

**Files changed**: 3 files, no backend changes.

