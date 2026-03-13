

# Add "Generate Packing Slip" to Pickup Station Bundle Detail

## Problem
When a user opens a bundle in the Pickup Station, the detail view shows items with checkboxes but has no action to generate a packing slip. The sticky footer only shows "X of Y selected" with no button.

## Solution
Add a "Generate Packing Slip" button to the bundle detail footer in `PickupStation.tsx`. This will reuse the same packing slip generation logic already in `LoadingStation.tsx` — creating a delivery (staged), delivery stop, and packing slip record from the selected items.

## Changes

### `src/pages/PickupStation.tsx`

1. **Add imports**: `useMutation`, `useQuery`, `useCompanyId`, `supabase`, `toast`, `FileText`, `Loader2`

2. **Add existing-delivery guard** (same pattern as LoadingStation): query `deliveries` table to check if a packing slip already exists for the bundle's `cutPlanId`

3. **Add `createPackingSlip` mutation** that:
   - Creates a `delivery` record (status: `staged`)
   - Creates a `delivery_stop`
   - Resolves project/customer data for packing slip header (ship_to, scope, site_address)
   - Builds `items_json` from `checkedItems` (only selected items)
   - Resolves invoice number via the same 4-step chain: `cut_plan_items → work_orders → barlists → extract_sessions` with order fallback
   - Inserts `packing_slips` row
   - On error: cleans up delivery + stops

4. **Update the sticky footer** to include:
   - A "Generate Packing Slip" button (disabled when no items selected or mutation in progress)
   - If packing slip already exists: show "Packing Slip Created" badge instead
   - The button uses the `FileText` icon and success toast on completion

### Footer layout (replacing current footer):
```
┌─────────────────────────────────────────────────┐
│  5 of 17 selected          [Generate Packing Slip] │
└─────────────────────────────────────────────────┘
```

If already created:
```
┌─────────────────────────────────────────────────┐
│  17 of 17 selected     ✓ Packing Slip Created     │
└─────────────────────────────────────────────────┘
```

### Files
- `src/pages/PickupStation.tsx` — add mutation + footer button (single file change)

