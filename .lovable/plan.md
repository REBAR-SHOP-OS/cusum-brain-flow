

# Fix "Create Invoice" in Accounting Tab to Use DraftInvoiceEditor

## Problem
The "Create Invoice" button on line 183 opens `CustomerSelectDialog` → `CreateTransactionDialog` (old modal flow). It should open the same `DraftInvoiceEditor` used in the Sales → Invoices page.

## Changes — `src/components/accounting/AccountingInvoices.tsx`

### A. Add imports
- Import `DraftInvoiceEditor` from `@/components/accounting/documents/DraftInvoiceEditor`
- Import `useCompanyId` from `@/hooks/useCompanyId`
- Import `useSalesInvoices` from `@/hooks/useSalesInvoices` (for `generateNumber`)

### B. Add state + hooks
```ts
const { companyId } = useCompanyId();
const { generateNumber } = useSalesInvoices();
const [editorInvoiceId, setEditorInvoiceId] = useState<string | null>(null);
```

### C. Replace "Create Invoice" button handler (line 183)
Instead of `setCustomerSelectOpen(true)`, create a draft record in `sales_invoices` and open the editor:
```ts
onClick={async () => {
  if (!companyId) return;
  const num = await generateNumber();
  const { data, error } = await supabase
    .from("sales_invoices")
    .insert({ invoice_number: num, company_id: companyId, status: "draft", issued_date: new Date().toISOString().slice(0, 10) })
    .select("id").single();
  if (error) { toast({ title: error.message, variant: "destructive" }); return; }
  setEditorInvoiceId(data.id);
}}
```

### D. Render DraftInvoiceEditor overlay
When `editorInvoiceId` is set, render the editor as full-page overlay (before the main return):
```tsx
if (editorInvoiceId) {
  return <DraftInvoiceEditor invoiceId={editorInvoiceId} onClose={() => setEditorInvoiceId(null)} />;
}
```

### E. Remove old dialog components
- Remove `CustomerSelectDialog` block (lines 352-361)
- Remove `CreateTransactionDialog` block (lines 363-372)
- Remove state: `customerSelectOpen`, `txnCustomer`
- Remove imports: `CustomerSelectDialog`, `CreateTransactionDialog`

## Files Changed
- `src/components/accounting/AccountingInvoices.tsx`

