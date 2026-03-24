

## Use Same Pipeline Columns in Sales Pipeline

### What
Replace the 8 Sales Pipeline stages (New, Contacted, Qualified, Estimating, Quote Sent, Follow Up, Won, Lost) with the exact same 26 stages from the main Pipeline (`PIPELINE_STAGES`).

### Changes

**File**: `src/hooks/useSalesLeads.ts`
- Replace `SALES_STAGES` array with the same stages as `PIPELINE_STAGES` from `src/pages/Pipeline.tsx` (all 26 stages: Prospecting, New, Telephonic Enquiries, QC - Ben, Estimation - Ben, ... through Archived / Orphan)
- Keep hex color format but map from the tailwind classes

**File**: `src/pages/sales/SalesPipeline.tsx`
- Update `SALES_STAGE_GROUPS` to match the main Pipeline's `STAGE_GROUPS` (Sales, Estimation, Quotation, Production, Closed)

**File**: `src/components/sales/SalesLeadDrawer.tsx`
- No changes needed — it already imports `SALES_STAGES` dynamically

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useSalesLeads.ts` | Replace `SALES_STAGES` with all 26 stages matching main Pipeline |
| `src/pages/sales/SalesPipeline.tsx` | Update stage groups to match main Pipeline groups |

