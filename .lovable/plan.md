

## Add PDF Preview to Takeoff Wizard Step 4

### What
After the takeoff completes (Step 4), add a "Preview Quotation PDF" button that opens the existing `QuotationTemplate` component — the same one used in the main Accounting Documents page — so the user can review/print the auto-generated quotation before saving.

### Changes

**File: `src/components/estimation/TakeoffWizard.tsx`**

1. Import `QuotationTemplate` from `@/components/accounting/documents/QuotationTemplate`
2. Add a `showPdf` state (`boolean`, default `false`)
3. In Step 4, add a "Preview Quotation" button (with a FileText icon) between the KPI cards and the "Save & View Project" button
4. When clicked, build a `QuotationData` object from `resultData`:
   - `quoteNumber`: generate from `generateQuotationNumber` (already available)
   - `customerName`: from selected customer in `customers` array
   - `projectName`: from `projectName` state
   - `items`: single line item from `resultData.summary` (weight in tonnes × cost-with-15%-margin per tonne)
   - `untaxedAmount` / `taxRate` (13% HST) / `taxAmount` / `total`: calculated from the above
   - Standard `terms` array (same as main quotation flow)
5. Render `<QuotationTemplate>` when `showPdf === true` with `onClose={() => setShowPdf(false)}`

This reuses the exact same PDF template the main quotation system uses — no new components needed.

