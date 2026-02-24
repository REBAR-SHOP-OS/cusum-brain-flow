

## Fix: Delivery Tile Navigation on ShopFloor Hub

### Problem
The "DELIVERY" tile on the shopfloor hub screens (`/shop-floor` and `/home`) does not navigate correctly to `/deliveries` when clicked.

### Root Cause
The tile uses React Router's `<Link>` component for cross-page navigation. In certain contexts (e.g., when navigating between pages with different layout structures), `<Link>` can fail to trigger a proper navigation. Using a native `<a>` tag ensures the browser performs a full navigation.

### Solution
Replace the `<Link>` component with a native `<a>` tag specifically for the Delivery card, since it navigates to a completely different page (`/deliveries`) rather than a sub-route under `/shopfloor/`.

### Changes

**File: `src/pages/ShopFloor.tsx`**
- In the hub cards grid rendering loop, detect when the card links outside the `/shopfloor/` prefix (i.e., the Delivery card pointing to `/deliveries`)
- Render those cards as native `<a href="...">` instead of `<Link to="...">`
- All other cards that link to `/shopfloor/*` sub-routes continue using `<Link>`

**File: `src/pages/Home.tsx`**
- Apply the same fix in the shopfloor dashboard section rendered for workshop users
- Delivery card rendered as `<a href="/deliveries">` instead of `<Link to="/deliveries">`

### Technical Detail
```
// Current (broken)
<Link to="/deliveries">DELIVERY</Link>

// Fixed
<a href="/deliveries">DELIVERY</a>
```

Both files share the same pattern: a mapped array of cards rendered with `<Link>`. The fix adds a conditional check so that external routes use `<a>` while internal shopfloor routes keep using `<Link>`.
