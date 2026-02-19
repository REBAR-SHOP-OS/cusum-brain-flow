
# Fix: Packing Slip Header Incorrect Data on /deliveries Page

## Root Cause Analysis

After examining the code and live database, the issues are located in **two files only**:

### Issue 1 — `src/pages/Deliveries.tsx` (lines 160–172 and 362–377)

The packing slips query uses `select("*")` on the `packing_slips` table, which does **not join the `deliveries` table**. As a result, `delivery_number` (e.g. `DEL-MLTV5F3Z`) is never fetched — only `slip_number` (e.g. `PS-MLTV5F3Z`) is available.

When the slip card is clicked to open the packing slip viewer (lines 366–377), `deliveryNumber` is incorrectly set to `slip.slip_number` instead of the actual delivery number.

Database reality (confirmed with live data):

| Field | DB Column | Current State |
|---|---|---|
| Customer | `packing_slips.customer_name` | Populated correctly |
| Ship To | `packing_slips.site_address` | Populated on some slips |
| Delivery # | `deliveries.delivery_number` (via join) | NOT fetched |
| Invoice # | `packing_slips.invoice_number` | Null on existing slips |
| Invoice Date | `packing_slips.invoice_date` | Null on existing slips |
| Scope | `packing_slips.scope` | Null on existing slips |
| Delivery Date | `packing_slips.delivery_date` | Populated correctly |

### Issue 2 — `src/components/delivery/DeliveryPackingSlip.tsx` (line 85)

The "Delivery #" field in the template currently renders only `{deliveryNumber}`. It must be changed to show the concatenated format: `[Invoice Number] - [Delivery Number]` (falling back gracefully if invoice number is absent).

### Product Table Status

The table columns in `DeliveryPackingSlip.tsx` are **already correct**: DW#, Mark, Quantity, Size, Type, Total Length — in the exact required order. No changes needed here.

---

## Exact Changes

### File 1: `src/pages/Deliveries.tsx`

**Change A — Update the packing slips query to join deliveries (lines 164–168):**

Change `select("*")` to also fetch `delivery_number` via the foreign key join to `deliveries`:

```ts
// Before
.select("*")

// After
.select("*, deliveries(delivery_number)")
```

Then map the result to expose `delivery_number` on each slip object.

**Change B — Fix the `setShowPackingSlip` call (lines 366–377):**

- Pass `deliveryNumber` from the joined `slip.deliveries?.delivery_number` instead of `slip.slip_number`
- Pass `shipTo` from `slip.ship_to` (currently missing from the call)

```ts
// Before
deliveryNumber: slip.slip_number,  // WRONG — was the slip #
// shipTo was never passed

// After
deliveryNumber: slip.deliveries?.delivery_number || slip.slip_number,
shipTo: slip.ship_to,  // ADD this
```

### File 2: `src/components/delivery/DeliveryPackingSlip.tsx`

**Change — Update "Delivery #" label to show concatenated format (line 85):**

```tsx
// Before
<p className="font-semibold">{deliveryNumber}</p>

// After
<p className="font-semibold">
  {invoiceNumber ? `${invoiceNumber} - ${deliveryNumber}` : deliveryNumber}
</p>
```

---

## Scope

| File | Lines | Change Type |
|---|---|---|
| `src/pages/Deliveries.tsx` | 164–168 (query) | Add join to deliveries |
| `src/pages/Deliveries.tsx` | 366–377 (setShowPackingSlip) | Fix deliveryNumber source, add shipTo |
| `src/components/delivery/DeliveryPackingSlip.tsx` | 85 | Concatenate invoice + delivery # |

**No other files. No database changes. No other UI elements. No other components.**

## What Is NOT Changed

- All delivery tabs (Today, Upcoming, All) — untouched
- Packing slip cards list layout — untouched
- Delete button, status badge — untouched
- Signature area, footer, header branding — untouched
- Product table columns — already correct, untouched
- All other pages and components — untouched
- Database schema — untouched
