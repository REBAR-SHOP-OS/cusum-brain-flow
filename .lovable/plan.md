

# Cross-Module Unification: Quotations & Invoices with Attachments

## Problem

The system has **3 separate quotation tables** and **2 invoice systems** that don't talk to each other properly:

```text
QUOTATION TABLES (fragmented)
┌─────────────────────┬───────────────────────┬────────────────────────┐
│ quotes              │ sales_quotations      │ quotations (view?)     │
│ (Odoo sync, AI,     │ (Sales module,        │ (quoteService.ts —     │
│  manual, accounting)│  state machine)       │  dead/broken table)    │
├─────────────────────┼───────────────────────┼────────────────────────┤
│ Used by:            │ Used by:              │ Used by:               │
│ • AccountingDocs    │ • SalesQuotations pg  │ • quoteService.ts only │
│ • convert-to-order  │ • quote_audit_log     │   (queries nonexistent │
│ • ai-generate-quote │ • agent tool executor │    "quotations" table) │
│ • quote-engine      │ • sales_invoices FK   │                        │
│ • Pipeline (leads)  │ • sales_quotation_    │                        │
│ • Inbox context     │   items FK            │                        │
│ • mcp-server        │                       │                        │
└─────────────────────┴───────────────────────┴────────────────────────┘

INVOICE SYSTEMS (disconnected)
┌──────────────────────┬──────────────────────┐
│ sales_invoices       │ QuickBooks Invoices   │
│ (ERP local table)    │ (QB API via hook)     │
├──────────────────────┼──────────────────────┤
│ • SalesInvoices page │ • AccountingInvoices  │
│ • DraftInvoiceEditor │ • QB attachments      │
│ • Has quotation_id   │ • No local DB link    │
│   FK → sales_quotas  │                       │
└──────────────────────┴──────────────────────┘
```

### Key Issues
1. **`quoteService.ts` queries `"quotations"` table** — this table likely doesn't exist (or is a view). Dead code.
2. **Agent creates in `sales_quotations` AND `quotes`** — dual-writes with brittle linking via `quote_result.quote_id`.
3. **`convert-quote-to-order` only reads `quotes`** — misses `sales_quotations`-only records.
4. **`sales_invoices.quotation_id` FK → `sales_quotations`** — but invoices created from accounting use `quotes` table IDs.
5. **No unified attachment system** — QuickBooks attachments are QB-only; local quotes/invoices have no attachment support.
6. **Accounting tab shows `quotes` table; Sales tab shows `sales_quotations`** — same data, different views, no cross-reference.

## Plan

### Phase 1: Fix Dead Code & Service Layer

**`src/lib/serviceLayer/quoteService.ts`** — Fix to query `quotes` (the actual table), not `quotations`.

### Phase 2: Unify Quote Resolution

**`supabase/functions/convert-quote-to-order/index.ts`** — Add fallback: if quote not found in `quotes`, check `sales_quotations` and resolve the linked `quotes` row via `quote_result.quote_id`.

**`src/components/accounting/AccountingDocuments.tsx`** — When clicking a quotation card, check if a `sales_quotations` record exists (via `quote_number` match) and load the richer data (state machine status, audit log, line items).

### Phase 3: Cross-Link Invoice ↔ Quotation

**`src/components/accounting/AccountingInvoices.tsx`** — Show the linked quotation number on invoice cards when `quotation_id` is present (query `sales_quotations` for the number).

**`src/components/accounting/documents/DraftInvoiceEditor.tsx`** — Add a "Linked Quotation" badge/link that opens the quotation when `quotation_id` or `metadata.source_quote_id` exists.

### Phase 4: Add Document Attachments

**Database migration** — Create `document_attachments` table:
```sql
CREATE TABLE document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  entity_type TEXT NOT NULL, -- 'quote', 'invoice', 'order'
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- storage bucket path
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
```

**New component: `src/components/accounting/DocumentAttachments.tsx`** — Reusable attachment widget (upload to Supabase Storage, list/download/delete) that can be embedded in:
- `DraftQuotationEditor` 
- `DraftInvoiceEditor`
- `QuotationTemplate` (view-only)
- Order detail views

**Storage bucket** — Create `document-attachments` bucket for file storage.

### Phase 5: Unified Status Display

**`src/components/accounting/AccountingDocuments.tsx`** — Merge status display logic:
- Show `sales_quotations` status (state machine) when available
- Fall back to `quotes.status` / `quotes.odoo_status`
- Show attachment count badge on cards that have attachments

### Files Changed

| File | Change |
|------|--------|
| `src/lib/serviceLayer/quoteService.ts` | Fix table name `quotations` → `quotes` |
| `supabase/functions/convert-quote-to-order/index.ts` | Add `sales_quotations` fallback lookup |
| `src/components/accounting/AccountingDocuments.tsx` | Show linked invoice count; show attachment badges |
| `src/components/accounting/AccountingInvoices.tsx` | Show linked quotation number on invoice cards |
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Add "Linked Quotation" badge |
| `src/components/accounting/documents/DraftQuotationEditor.tsx` | Embed `DocumentAttachments` widget |
| `src/components/accounting/DocumentAttachments.tsx` | **New** — reusable attachment upload/list component |
| Database migration | Create `document_attachments` table + RLS + storage bucket |

### Technical Notes
- The `quotes` table is the canonical source for accounting-facing quotations
- The `sales_quotations` table is the canonical source for sales-module quotations with state machine
- Agent dual-writes to both — this is preserved but the link (`quote_result.quote_id`) is made reliable
- `quoteService.ts` is fixed but remains optional (no consumers currently depend on it working)
- Attachments use Supabase Storage with RLS scoped to `company_id`

