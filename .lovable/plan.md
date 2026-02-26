

# Show Quotation View as Proper Document Template (Like Invoice)

## Problem
Currently, clicking "View" on an Odoo-synced quotation opens a simple side drawer (Sheet) with plain text fields. The user wants it to open the full **QuotationTemplate** — the same professional A4 document layout used for invoices, with company header, line items table, totals, and footer.

## What Changes

**File: `src/components/accounting/AccountingDocuments.tsx`**

1. **Replace the Sheet-based view** with the existing `QuotationTemplate` component for Odoo quotations
2. When "View" is clicked on an Odoo quotation, build a `QuotationData` object from the database record's fields and metadata (line items from `order_lines` / `line_items`, customer from `odoo_customer`, etc.)
3. Render `<QuotationTemplate data={...} onClose={...} />` as a full-page overlay — identical to how invoices already work

**Mapping logic** (database record → QuotationData):

| QuotationData field | Source |
|---|---|
| `quoteNumber` | `q.quote_number` |
| `quoteDate` | `q.created_at` |
| `expirationDate` | `q.valid_until` or fallback |
| `customerName` | `metadata.odoo_customer` |
| `items[]` | `metadata.order_lines` or `metadata.line_items` — map `name`→description, `product_uom_qty`→quantity, `price_unit`→unitPrice, compute amount |
| `untaxedAmount` | Sum of line amounts, or `q.total_amount` |
| `taxRate` | 0.13 (HST) |
| `taxAmount` | untaxed × 0.13 |
| `total` | untaxed × 1.13 |
| `terms` | Standard terms array |
| `inclusions/exclusions` | From metadata if present |

4. **Remove** the `<Sheet>` block (lines 458-501) entirely — replaced by the template overlay
5. The `viewQuote` state stays, but instead of rendering a Sheet it renders `<QuotationTemplate>`

## Technical Details

```text
// Replace Sheet block with:
{viewQuote && (() => {
  const meta = viewQuote.metadata as Record<string, unknown> | null;
  const lines = (meta?.order_lines || meta?.line_items) as Array<...> || [];
  const items = lines.map(l => ({
    description: l.name || l.description,
    quantity: l.product_uom_qty || l.quantity || 1,
    unitPrice: l.price_unit || l.unit_price || 0,
    amount: (qty * unitPrice),
  }));
  const untaxed = items.reduce((s, i) => s + i.amount, 0) || Number(viewQuote.total_amount);
  return <QuotationTemplate data={{
    quoteNumber: viewQuote.quote_number,
    quoteDate: new Date(viewQuote.created_at).toLocaleDateString(),
    expirationDate: viewQuote.valid_until ? ... : "—",
    customerName: meta?.odoo_customer || "Unknown",
    items,
    untaxedAmount: untaxed,
    taxRate: 0.13,
    taxAmount: untaxed * 0.13,
    total: untaxed * 1.13,
    terms: [...standard terms...],
  }} onClose={() => setViewQuote(null)} />;
})()}
```

This gives the exact same professional document view as invoices — with the Rebar.Shop header, line items table, tax breakdown, signature area, and print/PDF button.

