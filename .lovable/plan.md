

# Packing Slip Redesign -- Header Fields + Table Columns

## Current State

The `DeliveryPackingSlip` component currently shows:
- Header: Customer, Ship To, Delivery #, Date
- Table: Mark, Bar, Cut (mm), Shape, Qty

## What the Request Asks For

**Header:** Customer, Ship To, Delivery #, Invoice #, Invoice Date, Scope, Delivery Date
**Table columns:** DW#, Mark, Quantity, Size, Type, Total Length

## Data Availability Analysis

| Requested Field | Available? | Source |
|---|---|---|
| Customer (company_name) | Yes | `cut_plan` -> `project` -> `customer.company_name` (or use existing `customer_name` on packing_slips) |
| Ship To (site_address) | Yes | `cut_plan` -> `project.site_address` (currently not populated on packing_slips) |
| Delivery # | Yes | Already shown |
| Invoice # | NO | No `invoices` table exists in the DB |
| Invoice Date | NO | Same -- no invoices table |
| Scope | NO | No `scope_of_work` field on `projects` table |
| Delivery Date | Yes | `deliveries.scheduled_date` |
| DW# (Drawing Number) | Partially | `cut_plan_items.drawing_ref` exists but is NOT included in `items_json` snapshot |
| Size (bar_code) | Yes | Already in items_json as `bar_code` (e.g., "10M", "15M") |
| Type (Straight/Bent) | Derivable | If `asa_shape_code` is null -> "Straight", otherwise -> "Bent" |
| Total Length | Derivable | `cut_length_mm` converted to meters (cut_length_mm / 1000) |

## Plan

### Step 1 -- Database: Add missing columns to `packing_slips`

Add these nullable columns so the packing slip stores all header data at creation time:
- `invoice_number TEXT` (manually entered or linked later)
- `invoice_date DATE`
- `scope TEXT`
- `delivery_date DATE`
- `site_address TEXT` (separate from `ship_to` for clarity)

### Step 2 -- Update `useDeliveryActions.ts` to populate new fields

When creating a packing slip from a bundle, fetch the related `project.site_address` via the cut_plan's `project_id` and store it in the `ship_to` field. Also store `delivery_date` from the delivery's `scheduled_date`.

### Step 3 -- Update `items_json` snapshot to include `drawing_ref`

In `useDeliveryActions.ts`, add `drawing_ref` to each item in the snapshot so the packing slip template can display the DW# column.

### Step 4 -- Redesign `DeliveryPackingSlip.tsx`

**New Header (7 fields in 2 rows):**
Row 1: Customer | Ship To | Delivery # | Delivery Date
Row 2: Invoice # | Invoice Date | Scope | Slip #

**New Table Columns:**
| DW# | Mark | Quantity | Size | Type | Total Length |
|---|---|---|---|---|---|
| drawing_ref | mark_number | total_pieces | bar_code | Straight/Bent | cut_length_mm / 1000 + " m" |

**Footer total:** Sum of Quantity column

### Step 5 -- Update `Deliveries.tsx` to pass new props

When clicking a packing slip card, pass the additional fields (invoice_number, invoice_date, scope, delivery_date) from the slip data to the overlay component.

## Files Changed

| File | Change |
|---|---|
| Database migration | Add `invoice_number`, `invoice_date`, `scope`, `delivery_date` columns to `packing_slips` |
| `src/hooks/useDeliveryActions.ts` | Include `drawing_ref` in items snapshot; populate `ship_to` from project; store `delivery_date` |
| `src/components/delivery/DeliveryPackingSlip.tsx` | Redesign header to 7 fields; change table to DW#/Mark/Quantity/Size/Type/Total Length |
| `src/pages/Deliveries.tsx` | Pass new packing slip fields to the overlay component |

## Notes

- Invoice # and Scope will show as "--" until manually entered or a future invoicing module populates them
- Existing packing slips will still render correctly (new columns are nullable, items without `drawing_ref` show "--")
- No other pages or components are modified

