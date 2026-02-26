

## Problem

The quotation preview for Odoo-synced quotes (like S00024) shows **empty items** because the Odoo sync only stored basic metadata (`odoo_customer`, `odoo_state`, etc.) — no `order_lines` or `line_items` were imported. The code at lines 543-553 looks for `metadata.order_lines` or `metadata.line_items`, finds neither, and renders an empty table.

Similarly, QuickBooks estimates use `getQuotationData()` which parses `Line` array items — this works when the QB API returns line details, but can also be empty if the estimate has no `SalesItemLineDetail` lines.

## Plan

### 1. Add fallback summary row for Odoo quotes with no line items
In `AccountingDocuments.tsx` (lines 541-578), when `viewQuote` is rendered and `items` array is empty, generate a single fallback row using `total_amount` from the quote record:

```typescript
const fallbackItems = items.length > 0 ? items : [{
  description: "Rebar Fabrication & Supply",
  quantity: 1,
  unitPrice: Number(viewQuote.total_amount || 0),
  amount: Number(viewQuote.total_amount || 0),
}];
```

Use `fallbackItems` instead of `items` in the template data and for `untaxed` calculation.

### 2. Add customer address and project name from metadata
Extract `customerAddress` and `projectName` from metadata when available (Odoo stores `odoo_customer`, QB stores `CustomerRef`). Pass these to `QuotationTemplate` for richer display.

### 3. Same fallback for QuickBooks estimates
The `getQuotationData()` function (line 138) already has this fallback pattern — no change needed there.

### File changes
- **`src/components/accounting/AccountingDocuments.tsx`** — lines 541-578: Add fallback items row when no line items exist in Odoo quote metadata, and pass `customerAddress`/`projectName` from metadata.

