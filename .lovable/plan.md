

# Fix Quotation Cards: Customer Name, Total, Click-to-Edit, Delete

## Changes — `src/components/accounting/AccountingDocuments.tsx`

### A. Fix customer name (line 368)
Replace single-field lookup with multi-field fallback:
```ts
const meta = q.metadata as Record<string, unknown> | null;
const customer = (meta?.odoo_customer as string)
  || (meta?.customer_name as string)
  || q.salesperson
  || "Unknown";
```

### B. Fix total display (line 380)
Add fallback total from metadata line_items:
```ts
const lineItems = (meta?.line_items as Array<Record<string, unknown>>) || [];
const metaTotal = lineItems.reduce((s: number, li: any) => s + (Number(li.amount) || 0), 0);
const displayTotal = Number(q.total_amount) || metaTotal;
// Use displayTotal in the fmt() call
```

### C. Make card clickable (line 371)
Add `onClick` + `cursor-pointer` to open draft editor for manual/AI quotes, or view overlay for others:
```tsx
<Card key={q.id}
  className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer"
  onClick={() => {
    if (q.source === "manual" || q.source === "ai_estimation") {
      setDraftEditorId(q.id);
    } else {
      setViewQuote(q);
    }
  }}
>
```

### D. Add delete button
Add a Trash2 delete button in the actions area that removes the quote from the `quotes` table and refreshes the list.

### E. Fix QuotationTemplate customer name (line 588)
Add `meta?.customer_name` fallback:
```ts
customerName: (meta?.odoo_customer as string) || (meta?.customer_name as string) || viewQuote.salesperson || "Unknown",
```

## Files Changed
- `src/components/accounting/AccountingDocuments.tsx`

