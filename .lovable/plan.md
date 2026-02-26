

## Plan: Open Editable Quotation Editor for Manual Drafts

### Problem
When clicking "Manual", a draft record is created in the database but nothing opens because the preview logic looks for the quote in QuickBooks data (`data.estimates`), not the DB. The user expects a blank quotation form to fill in.

### Solution
Create a new `DraftQuotationEditor` component — a full-screen overlay (matching `QuotationTemplate` style) with editable fields. When "Manual" is clicked, the draft is created, then this editor opens instead of the read-only template.

---

### 1. Create `src/components/accounting/documents/DraftQuotationEditor.tsx`
An editable quotation form with:
- **Header fields**: Customer name (text input), project name (optional), expiration date (date picker)
- **Line items table**: Editable rows with description, quantity, unit price, auto-calculated amount. "Add row" button to append items. Delete button per row.
- **Totals**: Auto-calculated subtotal, tax rate input (default 13%), tax amount, total
- **Notes/terms**: Text area for additional notes
- **Actions**: "Save Draft" (updates the `quotes` record with all data stored in `metadata` JSONB), "Print / PDF", "Close"
- Layout matches the existing `QuotationTemplate` branding (logo, company info, signature area)

### 2. Update `src/components/accounting/AccountingDocuments.tsx`
- Add state `draftEditorId` (string | null) to track when the draft editor should open
- In `handleCreateDraft`: instead of `setPreviewId` / `setPreviewType`, set `draftEditorId` to the new quote's ID
- Add render block: when `draftEditorId` is set, render `<DraftQuotationEditor quoteId={draftEditorId} onClose={() => setDraftEditorId(null)} />`
- The editor fetches the quote from DB by ID, lets user edit, and saves back

### Files
- **Create**: `src/components/accounting/documents/DraftQuotationEditor.tsx`
- **Modify**: `src/components/accounting/AccountingDocuments.tsx` — wire draft editor instead of broken preview

