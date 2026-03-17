

## Auto Quotation from Estimation + Auto Quote Number

### Two Changes

**1. Auto-generate quotation number (format: Q20260001)**
- In `SalesQuotations.tsx` and `useSalesQuotations.ts`: when creating a new quotation, auto-generate the number by querying the latest quotation for the company and incrementing
- Format: `Q` + 4-digit year + 4-digit sequential number (e.g., `Q20260001`, `Q20260002`)
- Remove required manual input — auto-fill on dialog open, still editable

**2. Auto-create quotation after estimation takeoff completes**
- In `TakeoffWizard.tsx` step 4 (after `ai-estimate` returns): automatically create a `sales_quotations` record using the estimation result data
- Fields mapped:
  - `quotation_number` → auto-generated Q{year}{seq}
  - `customer_name` → from selected customer
  - `amount` → from `resultData.summary.total_cost` (with 15% margin)
  - `notes` → "Auto-generated from estimation: {project name}"
  - `status` → "draft"
- Show a toast confirming quotation was created

### File Changes

**`src/hooks/useSalesQuotations.ts`**
- Add `generateQuotationNumber()` function that queries max quotation_number for the company and returns next sequential number
- Export this function for use in TakeoffWizard

**`src/pages/sales/SalesQuotations.tsx`**
- On dialog open, auto-generate and pre-fill quotation number (remove manual requirement)
- Make quotation_number field read-only or pre-filled

**`src/components/estimation/TakeoffWizard.tsx`**
- After estimation completes (step 4, before `handleComplete`), insert a `sales_quotations` record via supabase
- Use the estimation project data for amount/customer info
- Show success toast with link to quotation

### Technical Details
- Auto-number query: `SELECT quotation_number FROM sales_quotations WHERE company_id = X AND quotation_number LIKE 'Q2026%' ORDER BY quotation_number DESC LIMIT 1`
- Parse last 4 digits, increment, zero-pad
- Fallback to `Q{year}0001` if none exist

