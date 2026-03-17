

# Fix: CEO Dashboard Missing Data — Status/Stage Mismatches

## Root Cause Analysis

The dashboard queries use hardcoded status values that **don't match the actual data** in your database. Here's every mismatch found:

| Metric | Code Filters For | Actual Data | Impact |
|--------|-----------------|-------------|--------|
| **Active Orders** | `active`, `pending` | `pending` (35), `needs_pricing` (28) | Shows 35, should show **63** |
| **Deliveries** | `pending`, `in-transit`, `loading` | `staged` (2) | Shows **0**, should show 2 |
| **Open Leads** | Excludes `closed_won`, `closed_lost` | Actual stages are `won`, `lost` (not `closed_won`/`closed_lost`) | Shows **2,948** (all leads), should show ~1,462 |
| **Pipeline chart** | Uses `closed_won`/`closed_lost` labels | 22 custom Odoo stages like `quotation_bids`, `hot_enquiries`, `fabrication_in_shop` | Pipeline chart shows wrong stage names |
| **Machines** | Shows 1/6 running (17% capacity) | CUTTER-02 is `running`, 5 idle | Correct but Ops score = 17 drags health to 59 |
| **Blocked Jobs** | `production_locked = true` | No orders have status `confirmed`/`in_production` | Always **0** |
| **QC Backlog** | `qc_final_approved = false` + `in_production` | No `in_production` orders exist | Always **0** |

## Fix Plan

### 1. Fix Order Status Filter (`useCEODashboard.ts` ~line 175)
Include `needs_pricing`, `confirmed`, `in_production` in addition to `active`, `pending`.

### 2. Fix Delivery Status Filter (~line 178)
Add `staged` to the delivery status filter alongside `pending`, `in-transit`, `loading`.

### 3. Fix Lead Stage Exclusion (~lines 179, 191, 454)
Change `closed_won`/`closed_lost` to `won`/`lost` to match actual Odoo stage names. Also exclude `archived_orphan`, `loss`, `merged`, `no_rebars_out_of_scope`, `delivered_pickup_done` from "open" leads count.

### 4. Fix Pipeline Stage Labels (~line 42-50 in CEODashboardView)
Replace the hardcoded `stageLabels` map with labels that match the actual 22 Odoo stages (e.g., `quotation_bids` → "Quotation", `hot_enquiries` → "Hot Enquiry", `fabrication_in_shop` → "Fabrication").

### 5. Fix QC/Blocked Queries (~lines 451-453)
Widen the order status filter for blocked jobs and QC backlog to include `pending`, `needs_pricing` and any future production statuses.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useCEODashboard.ts` | Fix 6 status/stage filters to match real DB data |
| `src/components/office/CEODashboardView.tsx` | Update `stageLabels` map for Odoo pipeline stages |

