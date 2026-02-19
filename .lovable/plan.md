
# Add "Driver" to Desktop Sidebar Navigation

## Current State

The `/driver` route, `DriverDashboard` page, and mobile bottom nav tab were already added in a previous change. The mobile nav (`MobileNavV2`) already shows "Driver" for mobile users.

The **desktop sidebar** (`AppSidebar.tsx`) is the only navigation surface missing a "Driver" entry. It has no reference to `/driver` anywhere.

## Scope

**Single file, single addition:**

| File | Change |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Add one `NavItem` for Driver under the "Logistics" group |

No other files are touched. No styling changes. No database changes. No logic changes.

## The Fix

The "Logistics" group in `AppSidebar.tsx` currently contains:

```
Logistics
├── Deliveries  → /deliveries   (roles: admin, field, office)
└── Inventory   → /office       (roles: admin, office, workshop)
```

One new item will be inserted after "Deliveries":

```
Logistics
├── Deliveries  → /deliveries   (roles: admin, field, office)
├── Driver      → /driver       (roles: admin, field, office)   ← NEW
└── Inventory   → /office       (roles: admin, office, workshop)
```

- Icon: `Truck` (already imported at line 3)
- Roles: `["admin", "field", "office"]` — mirrors Deliveries, since drivers are field/admin users
- Lock reason: `"Requires Field or Office role"` — consistent with Deliveries
- `tourId`: `"nav-driver"` — consistent naming convention

## Technical Detail

The change is a single object insertion in the `navGroups` array at lines 171–175 of `AppSidebar.tsx`:

```diff
  { name: "Deliveries", href: "/deliveries", icon: Truck, roles: ["admin", "field", "office"], lockReason: "Requires Field or Office role", tourId: "nav-deliveries" },
+ { name: "Driver", href: "/driver", icon: Truck, roles: ["admin", "field", "office"], lockReason: "Requires Field or Office role", tourId: "nav-driver" },
  { name: "Inventory", href: "/office", icon: Package, ... },
```

The `Truck` icon is already imported — no new import needed.

## What Is NOT Changed

- `MobileNavV2.tsx` — already has Driver tab, untouched
- `App.tsx` — route already exists, untouched
- `DriverDashboard.tsx` — page already exists, untouched
- All other nav groups (Office, Production, QA, System) — untouched
- All existing Logistics items (Deliveries, Inventory) — untouched
- Styling, logic, database — untouched
