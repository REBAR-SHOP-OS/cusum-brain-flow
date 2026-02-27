

## Build New Delivery Ops & Delivery Terminal Pages

Based on the reference screenshots, two new pages need to be created:

### Page 1: Delivery Ops (`/shopfloor/delivery-ops`)
A dark-themed card list showing deliveries ready for dispatch. Each card displays:
- Customer/project name (bold, e.g. "CAGES")
- Bundle count + purpose ("3 bundles for site drop")
- Status badge ("STAGED AT SHOP")
- Click navigates to the delivery terminal for that delivery's stop

Data source: `deliveries` table joined with `delivery_stops` and `packing_slips`.

### Page 2: Delivery Terminal (`/shopfloor/delivery/:stopId`)
A full-page mobile-optimized jobsite terminal showing:
- Header: Customer name + "JOBSITE DELIVERY TERMINAL" subtitle
- Back button, download/print actions
- Unloading site label + "LAUNCH NAV" button (opens Google Maps)
- Side-by-side capture boxes: "SITE DROP PHOTO" (camera capture) + "CUSTOMER SIGN-OFF" (tap-to-sign canvas)
- Unloading checklist: 2-column grid of items from `packing_slips.items_json` with checkboxes (DW#, mark, qty info)

POD data (photo path, signature) persisted to `delivery_stops` columns (`pod_photo_url`, `pod_signature`).

### Files to Create
1. **`src/pages/DeliveryOps.tsx`** — Card grid of active deliveries with status badges
2. **`src/pages/DeliveryTerminal.tsx`** — Full-page drop-off terminal with photo capture, signature pad, and unloading checklist
3. **`src/components/delivery/SignaturePad.tsx`** — Canvas-based signature component (tap to sign, clear, save as PNG)

### Files to Edit
1. **`src/App.tsx`** — Add routes: `/shopfloor/delivery-ops` and `/shopfloor/delivery/:stopId`
2. **`src/pages/ShopFloor.tsx`** — Add "DELIVERY OPS" hub card back to the grid

### Implementation Details
- **DeliveryOps**: Query `deliveries` with status in ('pending','scheduled','staged','in-transit'), join `delivery_stops` for stop count, join `packing_slips` for item counts. Show card per delivery with customer name, bundle summary, status.
- **DeliveryTerminal**: Fetch stop by ID, load packing slip items from `packing_slips.items_json` via `delivery_id`. Photo capture uses `<input type="file" capture="environment">`, uploaded to `clearance-photos` bucket under `pod/` prefix. Signature uses HTML5 canvas. Both paths written to `delivery_stops.pod_photo_url` and `delivery_stops.pod_signature`.
- **SignaturePad**: Standalone canvas component with touch/mouse drawing, "Clear" button, and `onSave(dataUrl)` callback that uploads the PNG to storage.
- Style matches the reference: dark background, white card for the terminal content, uppercase tracking-wide headers, dashed border capture zones.

