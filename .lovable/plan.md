

## Audit: Driver Dropoff Page — Issues Found & Improvements

### Bug: Signature Ink is Nearly Invisible
**Critical.** In `SignaturePad.tsx` line 27, the stroke color is `hsl(0, 0%, 90%)` — that's near-white. Signatures are being drawn but almost invisible on the white canvas. Must change to a dark color like `#000` or `hsl(0, 0%, 10%)`.

### Bug: Driver Signature Not Uploaded
In `DriverDropoff.tsx`, the driver captures `driverSignatureData` (line 30) but it is **never uploaded or saved** — only the customer signature (`signatureData`) gets uploaded. The driver signature is collected but discarded on submit.

**Fix:** Upload the driver signature as a second file (e.g. `*-driver-sig-*.png`) and save the path to `delivery_stops` (can use the existing `notes` field or a new metadata approach, or store alongside the customer sig in packing_slips).

### Bug: `delivery_stops.update` Uses `Record<string, unknown>`
Line 116 — the `updates` object for `delivery_stops` is typed as `Record<string, unknown>`, which can cause the same build error pattern we've been fixing. Should use explicit typing.

### Improvement: Empty State for No Items
If the packing slip has zero items (or no packing slip found), the table renders with just headers and no body. Should show a clear message like "No items on this slip".

### Improvement: Loading State Missing
The page has no loading indicator while `stop` or `packingSlip` queries are in flight. On slow connections the page appears blank.

### Improvement: Slip Number Not Shown
The packing slip has a `slip_number` field but it's not displayed anywhere on the document.

---

### Changes

**`src/components/shopfloor/SignaturePad.tsx`**
- Change stroke color from `hsl(0, 0%, 90%)` to `#000000` (black ink)

**`src/pages/DriverDropoff.tsx`**
1. Upload driver signature blob alongside customer signature on submit
2. Type the `updates` object explicitly instead of `Record<string, unknown>`
3. Add loading spinner while queries load
4. Show empty state when items array is empty
5. Display `slip_number` in the document header
6. Save driver signature path to packing_slips or delivery_stops

