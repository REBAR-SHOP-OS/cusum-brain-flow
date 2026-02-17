

# Fix: Add All Missing Odoo Pipeline Stages

## Problem

The ERP pipeline is missing many columns that exist in Odoo. Currently, several Odoo stages are collapsed into other stages (e.g., "Fabrication In Shop" maps to "shop_drawing", "Delivered/Pickup Done" maps to "won"). The user wants every Odoo stage to appear as its own column, matching Odoo exactly.

## Missing Stages (from Odoo screenshots)

These stages exist in Odoo but are missing from the ERP board:

- Fabrication In Shop (currently collapsed into Shop Drawing)
- Ready To Dispatch/Pickup (currently collapsed into Won)
- Delivered/Pickup Done (currently collapsed into Won)
- Out for Delivery (missing entirely)
- No rebars/Out of Scope (currently collapsed into Lost)
- Loss (currently collapsed into Lost)
- Merged (currently collapsed into Lost)
- Temp: IR/VAM (missing entirely)
- Migration-Others (missing entirely)
- Estimation-Others (missing entirely)
- Estimation Partha (missing entirely)
- Dreamers (missing entirely)

Additionally, Qualified, RFI, Addendums, and Quotation Priority were incorrectly labeled as "ERP-only" when they DO exist in Odoo.

## Changes

### 1. Update PIPELINE_STAGES in `src/pages/Pipeline.tsx`

Add all missing Odoo stages to the board in their correct Odoo order:

```text
Prospecting > New > Telephonic Enquiries > QC - Ben > 
Estimation - Ben > Estimation - Karthick > Estimation - Others > 
Estimation Partha > Hot Enquiries > Qualified > RFI > Addendums > 
Quotation Priority > Quotation Bids > Won > Lost > Loss > Merged > 
Shop Drawing > Shop Drawing Sent for Approval > Fabrication In Shop > 
Ready To Dispatch/Pickup > Delivered/Pickup Done > Out for Delivery > 
No rebars (Out of Scope) > Temp: IR/VAM > Migration-Others > Dreamers
```

Remove the "ERP-only" comment since these stages all exist in Odoo.

### 2. Update STAGE_MAP in `supabase/functions/odoo-crm-sync/index.ts`

Stop collapsing stages -- each Odoo stage gets its own unique ERP stage ID:

| Odoo Stage | Current Mapping | New Mapping |
|---|---|---|
| Fabrication In Shop | shop_drawing | fabrication_in_shop |
| Ready To Dispatch/Pickup | won | ready_to_dispatch |
| Delivered/Pickup Done | won | delivered_pickup_done |
| Out for Delivery | (missing) | out_for_delivery |
| No rebars(Our of Scope) | lost | no_rebars_out_of_scope |
| Loss | lost | loss |
| Merged | lost | merged |
| Temp: IR/VAM | (missing) | temp_ir_vam |
| Migration-Others | (missing) | migration_others |
| Estimation-Others | (missing) | estimation_others |
| Estimation Partha | (missing) | estimation_partha |
| Dreamers | (missing) | dreamers |

### 3. Data Migration

Existing leads that were previously collapsed into wrong stages need to be corrected. On the next full Odoo sync, the reconciliation step will automatically fix them since the STAGE_MAP now maps correctly. No manual SQL migration needed.

## Files Modified

| File | Change |
|---|---|
| `src/pages/Pipeline.tsx` | Add all missing stages to PIPELINE_STAGES in Odoo order |
| `supabase/functions/odoo-crm-sync/index.ts` | Update STAGE_MAP so each Odoo stage has its own unique ID |

No database schema changes needed -- the `stage` column is a text field that accepts any value.

