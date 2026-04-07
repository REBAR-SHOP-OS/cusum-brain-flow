

# Unify Sales Quotations with Accounting Quotation System

## Problem
The Sales `/sales/quotations` page uses its own basic implementation (`sales_quotations` table, simple create dialog, basic table view). The Accounting page has a full-featured quotation system (`quotes` table) with Sign, Convert to Order, View, AI Auto-generation, drag-and-drop, and `DraftQuotationEditor`.

## Solution
Replace the entire `SalesQuotations.tsx` content with a thin wrapper that renders `AccountingDocuments` with `initialDocType="quotation"`, using `useQuickBooksData` to supply the required `data` prop.

## Change

### `src/pages/sales/SalesQuotations.tsx`
Replace the entire file with:
- Import `useQuickBooksData` and `AccountingDocuments`
- Call `useQuickBooksData()` to get the data prop
- Render `AccountingDocuments` with `data={qb}` and `initialDocType="quotation"`
- Keep TakeoffWizard integration if drag-drop is still needed (AccountingDocuments already has its own `DocumentUploadZone`)

```text
SalesQuotations (new)
└── AccountingDocuments (initialDocType="quotation")
    ├── Search + Status Filter
    ├── Add Quotation (Manual / AI Auto)
    ├── DocumentUploadZone (drag-and-drop)
    ├── Quotation Cards (Sign, Convert to Order, View, Delete)
    └── DraftQuotationEditor / QuotationTemplate viewers
```

### Impact
- Single file replaced
- Sales users see the exact same quotation UI as Accounting (screenshot 1)
- All quotations come from the unified `quotes` table
- No database changes needed

