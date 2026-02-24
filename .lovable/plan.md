

## Remove "ESTIMATION" from Shopfloor Hub Screens

### Problem
The "ESTIMATION" card appears on the shopfloor "SELECT INTERFACE" screen, but Estimation is an office/admin tool (AI Takeoff and Bids), not a production floor interface. Shopfloor workers should not see it alongside Material Pool, Clearance, Loading, etc.

### Solution
Remove the ESTIMATION entry from the hub cards array in both places where the shopfloor hub is rendered.

### Changes

**File: `src/pages/ShopFloor.tsx`**
- Remove the ESTIMATION object from the `hubCards` array (the last entry with `label: "ESTIMATION"`, linking to `/estimation`)

**File: `src/pages/Home.tsx`**
- Remove the ESTIMATION object from the `shopfloorCards` array (the entry with `label: "ESTIMATION"`, linking to `/estimation`)

This leaves 7 hub cards (Material Pool, Shop Floor, Clearance, Loading, Delivery, Pickup, Inventory) which is a cleaner fit for the grid layout.

