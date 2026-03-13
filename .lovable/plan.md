

# Show Packing Slip Preview After Generation in Pickup Station

## Problem
Currently, clicking "Generate Packing Slip" in the Pickup Station only creates the database record and shows a toast. It does not open the `PackingSlipPreview` overlay (with Print/PDF, Email, Signature) like the Delivery Terminal does.

## Solution
After the packing slip is created (or when "Packing Slip Created" badge exists), show the `PackingSlipPreview` component — same full-page overlay used in `DeliveryTerminal.tsx` with print, email, and signature display.

## Changes — `src/pages/PickupStation.tsx`

1. **Import** `PackingSlipPreview` from `@/components/delivery/PackingSlipPreview`

2. **Add state**: `showSlipPreview` (boolean) and `slipPreviewData` (stores slipMeta, customerName, siteAddress, items for the preview)

3. **On mutation success** (`onSuccess`): populate `slipPreviewData` from the bundle data already available (customerName, items, invoice info resolved during mutation) and set `showSlipPreview = true`

4. **Store resolved metadata** in a ref during mutation so it's available for the preview (shipTo, scope, invoiceNumber, invoiceDate, deliveryDate, slipNumber)

5. **"Packing Slip Created" badge** becomes clickable — clicking it also opens the preview

6. **Render** `<PackingSlipPreview>` at the bottom of the component when `showSlipPreview` is true, passing the resolved slip metadata and items

### UI Flow
- User clicks "Generate Packing Slip" → mutation runs → on success → preview overlay opens automatically
- If slip already exists → user clicks "Packing Slip Created" badge → preview opens with data fetched from `packing_slips` table

