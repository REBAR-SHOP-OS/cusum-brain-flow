

## Plan: Add Click-to-View for Signed Delivery Cards

The signed delivery cards in `PackingSlipsView.tsx` (lines 271-290) are static — no `onClick`, no detail view. We need to make them expandable so clicking a card reveals the signature image and site drop photo.

### Changes (single file: `src/components/office/PackingSlipsView.tsx`)

1. **Add state** for the selected signed delivery (`selectedSignedStop`)

2. **Make each card clickable** with `onClick` and cursor-pointer styling

3. **Add a detail dialog/panel** that shows:
   - Delivery number, address, customer name
   - The POD signature image (resolved from storage path via `createSignedUrl`)
   - The site drop photo (resolved from storage path via `createSignedUrl`)
   - Driver name and date from the joined `deliveries` data
   - A close button

4. **Resolve storage URLs** on demand when a card is clicked — the `pod_signature` and `pod_photo_url` fields store storage paths, so we need `supabase.storage.from("clearance-photos").createSignedUrl(path, 3600)` to get viewable URLs

### Technical details

- The `delivery_stops` query already joins `deliveries(id, delivery_number, scheduled_date, driver_name)` and `customers(name)` — all needed metadata is available
- Storage paths follow pattern `{companyId}/signatures/{orderId}-{timestamp}.png` for signatures and similar for photos
- Use a Radix Dialog for the detail view, consistent with the rest of the app
- No database or schema changes needed

