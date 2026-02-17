

# Delivery Workflow: Evidence, Packing Slip, Signature, Photo, and Archive

## Overview

Build the complete delivery workflow: select a cleared bundle, create a delivery with a printable packing slip, capture a canvas signature and job site photo at delivery, and archive everything.

## Current State

- "Create Delivery" button exists but is disabled
- No link between bundles (cut plans) and deliveries in the database
- A `PackingSlipTemplate` exists in accounting but is not connected to the delivery flow
- POD dialog uses a text input for signature instead of the canvas `SignaturePad` already used elsewhere
- No packing slip archive table

## Changes

### 1. Database Migration

**Add `cut_plan_id` to `deliveries` table** to link deliveries to their source bundle.

**Create `packing_slips` table** to archive generated slips:

```text
packing_slips
  id              uuid PK
  company_id      uuid FK -> companies
  delivery_id     uuid FK -> deliveries
  cut_plan_id     uuid FK -> cut_plans
  slip_number     text
  customer_name   text
  ship_to         text
  items_json      jsonb       (snapshot of items at time of creation)
  signature_path  text        (storage path to signature image)
  site_photo_path text        (storage path to job site photo)
  status          text        (default 'draft', then 'delivered', 'archived')
  created_at      timestamptz
  updated_at      timestamptz
```

RLS: company_id scoped, same pattern as other tables.

### 2. Enable "Create Delivery" from Bundle (Deliveries page)

When user clicks "Create Delivery" on a selected bundle:
- Create a new `deliveries` row with `cut_plan_id`, auto-generated delivery number, status "pending"
- Create one `delivery_stops` row with the project's ship-to address (or blank for user to fill)
- Generate a packing slip record in `packing_slips` with items snapshot
- Show the `DeliveryPackingSlip` dialog (printable) immediately

### 3. New `DeliveryPackingSlip` Component

Reuse the visual layout from the existing `PackingSlipTemplate` but adapt it for delivery context:
- Header: company branding
- Info grid: customer name, ship-to, delivery number, date
- Items table: mark number, bar code, cut length, quantity (from the bundle items)
- Print / PDF button
- Close button returns to delivery detail

### 4. Upgrade POD Capture with Canvas Signature

Replace the text `Textarea` in `PODCaptureDialog` with the existing `SignaturePad` canvas component:
- Import `SignaturePad` from `@/components/shopfloor/SignaturePad`
- Capture signature as base64 PNG, upload to `clearance-photos` storage bucket
- Store path in `pod_signature` and also update the related `packing_slips.signature_path`

### 5. Job Site Photo in POD Flow

The photo capture already exists in `PODCaptureDialog`. Ensure:
- Photo uploads to `clearance-photos` bucket (already does)
- Update `packing_slips.site_photo_path` with the storage path alongside the stop update

### 6. Packing Slip Archive View

Add a "Packing Slips" tab or section within the Deliveries page (inside the existing Tabs):
- New tab: "Slips (N)" showing all archived packing slips
- Each card shows slip number, customer, date, status badge
- Click to open the printable packing slip view
- Filter by status (draft / delivered / archived)

## Files

| File | Change |
|---|---|
| **Database migration** | Add `cut_plan_id` to deliveries, create `packing_slips` table with RLS |
| `src/pages/Deliveries.tsx` | Enable "Create Delivery" button, add packing slip tab, wire up new dialogs |
| `src/components/delivery/DeliveryPackingSlip.tsx` | **New** -- printable packing slip adapted for delivery bundles |
| `src/components/delivery/PODCaptureDialog.tsx` | Replace text signature with canvas `SignaturePad`, update packing slip record on complete |
| `src/hooks/useDeliveryActions.ts` | **New** -- hook for creating delivery + packing slip from a bundle |

## Workflow Summary

```text
Bundle "Ready" --> Click "Create Delivery"
  --> delivery row created
  --> packing_slips row created (items snapshot)
  --> Packing Slip dialog opens (printable for customer)

Driver Mode --> Stop card --> POD button
  --> Canvas signature + job site photo
  --> Uploads to storage
  --> Updates delivery_stops + packing_slips with paths
  --> Status moves to "delivered"

Packing Slips tab
  --> Browse all slips
  --> Click to reprint
  --> Status: draft / delivered / archived
```

