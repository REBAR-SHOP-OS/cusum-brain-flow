

## Fix: Build Error + Match Packing Slip UI to Attached Image

### Build Error
The `as any` casts on `packing_slips` queries are causing the build to fail — `packing_slips` exists in the typed schema, so the casts must be removed.

### UI Changes to Match Attached Image
The current driver dropoff page has the right data but doesn't visually match the packing slip layout. Changes needed:

#### `src/pages/DriverDropoff.tsx`

1. **Remove `as any` casts** on lines 57, 138 — `packing_slips` is a valid typed table, casting breaks the production build

2. **Restyle packing slip header** to match the image layout:
   - Company header: "Rebar.Shop Inc" + address + "Packing Slip" title aligned right
   - Row 1: CUSTOMER | SHIP TO | DELIVERY # | DELIVERY DATE in bordered boxes
   - Row 2: INVOICE # | INVOICE DATE | SCOPE in bordered boxes

3. **Restyle items table** to match the image:
   - Proper table headers: DW# | Mark | Quantity Size | Type | Cut Length
   - Each row shows data in columns matching the image
   - Checkmark column added on the left for driver verification
   - Total row at bottom with piece count

4. **Add dual signature areas** matching the image:
   - "Delivered By (Signature)" — line with label (driver signs)
   - "Received By (Signature)" — uses the existing `SignaturePad` component (customer signs)
   - Both labeled clearly below the signature lines

5. **Move photo capture below signatures** — less prominent, keep it as a secondary action

6. **Footer** with company contact info matching the image

### Files
- **Edit**: `src/pages/DriverDropoff.tsx` — remove `as any`, restyle to match packing slip image layout with checkmarks + dual signature areas

