

# Add View and Delete Actions to Invoice List

## Changes

### `src/pages/sales/SalesInvoices.tsx`

1. **Add an "Actions" column** to the table header
2. **Add View and Delete buttons** per row:
   - **View (Eye icon)**: Opens the `DraftInvoiceEditor` (same as clicking the row — just makes it explicit)
   - **Delete (Trash2 icon)**: Deletes the invoice from `sales_invoices` with a confirmation dialog, then invalidates the query cache
3. **Delete uses `stopPropagation`** so clicking the delete button doesn't also open the editor
4. **Delete confirmation** via `window.confirm()` to prevent accidental data loss — consistent with the quotation card delete pattern
5. **Import** `Eye, Trash2` from lucide-react and `useQueryClient` from tanstack

### Row layout change
```text
| Number | Customer | Status | Amount | Issued | Due | Actions      |
|        |          |        |        |        |     | [👁] [🗑]    |
```

### Delete logic
- Call `supabase.from("sales_invoices").delete().eq("id", inv.id)`
- On success: `toast.success`, invalidate `["sales-invoices"]` query
- On error: `toast.error`

Single file change. No database changes.

