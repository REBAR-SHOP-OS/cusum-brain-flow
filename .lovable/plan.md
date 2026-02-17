
# Fix: Make "Cleared - Ready for Delivery" Bundles Clickable

## Problem
The cleared bundles listed under "CLEARED -- READY FOR DELIVERY" on the Deliveries page are not interactive. Clicking them does nothing because the `ReadyBundleList` component is rendered without an `onSelect` handler. The component supports it (via the `onSelect` prop), but no callback is wired up.

## Solution
Wire up the `onSelect` prop on the `ReadyBundleList` component in the Deliveries page so that clicking a bundle opens a detail panel showing the bundle contents (items, bar codes, piece counts). This uses the existing right-side detail panel already built into the page.

## What Changes

### 1. Add bundle detail state to Deliveries page (`src/pages/Deliveries.tsx`)
- Add a `selectedBundle` state variable alongside the existing `selectedDelivery` state
- When a bundle is clicked, show its details in the right panel (same area used for delivery details)
- Clicking a bundle clears any selected delivery, and vice versa

### 2. Wire up `onSelect` on `ReadyBundleList`
- Pass an `onSelect` handler that sets the selected bundle and clears any selected delivery

### 3. Add a Bundle Detail Panel in the right column
- Show the bundle project name, plan name, total pieces, and item count
- List each item with mark number, bar code, cut length, and piece count
- Include a "Create Delivery" button (disabled/coming soon) to eventually convert the bundle into a delivery

### 4. Same fix on PickupStation page (`src/pages/PickupStation.tsx`)
- Wire up `onSelect` so bundles are also clickable on the Pickup Station page

## Technical Details

### Deliveries.tsx changes

```text
State additions:
  selectedBundle: CompletedBundle | null

onSelect handler:
  Sets selectedBundle, clears selectedDelivery

Right panel:
  If selectedBundle is set, render a BundleDetailPanel showing:
    - Project name (header)
    - Plan name
    - Item count and total pieces
    - Scrollable list of items (mark, bar code, length, qty)
    - "Create Delivery" button (disabled, coming soon)
```

### Files Modified

| File | Change |
|---|---|
| `src/pages/Deliveries.tsx` | Add `selectedBundle` state, wire `onSelect`, add bundle detail panel in right column |
| `src/pages/PickupStation.tsx` | Wire `onSelect` to show bundle details (dialog or inline) |
