

# Link Draft Quotations to Source Sales Lead

## Problem
When creating a quotation from a sales lead's "+" button, the `lead_id` is never passed along. The draft quote is created without a `lead_id`, so "Add to Timeline" fails with "not linked to any sales lead."

## Fix — 3 touch points

### 1. `src/components/sales/LeadSmartButtons.tsx`
Pass `lead_id` as a URL parameter when navigating to quotations:
```tsx
navigate(`/sales/quotations?lead_id=${leadId}`);
```
Both the "+" icon clicks (lines 151 and 212) need this change.

### 2. `src/components/accounting/AccountingDocuments.tsx`
Read `lead_id` from `useSearchParams` and include it in the `handleCreateDraft` insert:
```tsx
const [searchParams] = useSearchParams();
const leadIdParam = searchParams.get("lead_id");

// In the insert:
.insert({
  quote_number: quoteNumber,
  status: "draft",
  source: "manual",
  total_amount: 0,
  company_id: companyId,
  lead_id: leadIdParam || null,  // NEW
})
```

### 3. No changes to `DraftQuotationEditor.tsx`
It already reads `lead_id` from the quote record (line 137) and uses it for "Add to Timeline."

## Files Changed

| File | Change |
|---|---|
| `src/components/sales/LeadSmartButtons.tsx` | Add `lead_id` query param to navigation |
| `src/components/accounting/AccountingDocuments.tsx` | Read `lead_id` from URL, pass to insert |

No database changes needed — `quotes.lead_id` column already exists.

