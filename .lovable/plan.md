
# Fix: Detail Panel Header Shows Delivery Number Instead of Customer Name + Invoice Number

## Root Cause — Exact Location

There is **no `DeliveryListItem.tsx` component** — the deliveries page is fully self-contained in `src/pages/Deliveries.tsx`.

The bug is **NOT** in the list cards. The `DeliveryCard` component (lines 601–639) already correctly shows customer name when available:
```tsx
{delivery.customer_name
  ? `${delivery.customer_name}${delivery.invoice_number ? ` (Invoice #${delivery.invoice_number})` : ""}`
  : delivery.delivery_number}
```

The bug is in the **right-side detail panel header** at **line 433**, which always shows the raw `delivery_number`:
```tsx
<h2 className="text-lg font-semibold flex-1">{selectedDelivery.delivery_number}</h2>
```

When a user clicks a delivery card, the detail panel opens and the header `<h2>` displays `DEL-MLTV5F3Z` (the `delivery_number`) instead of the customer name and invoice number.

## Confirmed Data

Database query confirms that `customer_name` IS being correctly fetched and mapped onto deliveries:
- `DEL-MLTV5F3Z` → `customer_name: "EARNSCLIFFE CRICKET AIR DOME"`, `invoice_number: null`

The join query at line 129 (`select("*, packing_slips(customer_name, invoice_number)")`) and the mapping at lines 134–138 work correctly.

## The Fix — One Surgical Change

**File:** `src/pages/Deliveries.tsx`
**Line:** 433

Change the detail panel `<h2>` to display `customer_name - invoice_number` when available, falling back to `delivery_number`:

**Before (line 433):**
```tsx
<h2 className="text-lg font-semibold flex-1">{selectedDelivery.delivery_number}</h2>
```

**After:**
```tsx
<h2 className="text-lg font-semibold flex-1">
  {selectedDelivery.customer_name
    ? `${selectedDelivery.customer_name}${selectedDelivery.invoice_number ? ` - ${selectedDelivery.invoice_number}` : ""}`
    : selectedDelivery.delivery_number}
</h2>
```

This matches the exact format requested: "Customer Name - Invoice Number", with a graceful fallback to the delivery number when no customer name is linked.

## Scope

| File | Line | Change |
|---|---|---|
| `src/pages/Deliveries.tsx` | 433 | Update `<h2>` in detail panel header to show `customer_name - invoice_number` instead of always showing `delivery_number` |

## What Is NOT Changed
- `DeliveryCard` list items — already correct, untouched
- Data fetching queries — untouched
- All other UI elements, stops list, stats bar, tabs, slips tab
- Database schema
- Any other component or page
