

# Separate Live Monitor from CEO Portal

## Problem
The sidebar item "Live Monitor" links to `/ceo`, which is the super-admin-only CEO Portal. The actual `LiveMonitorView` component (Shop Floor HUD with machine status, tonnage, production jobs) exists but is only accessible as a tab inside the Admin Panel. Sales managers and office staff can't access it.

## Plan

### 1. Create `/live-monitor` route and page
Create `src/pages/LiveMonitor.tsx` — a simple page wrapper that renders `LiveMonitorView`. Access gated to `admin`, `office`, `sales` roles (not super-admin-only).

### 2. Update sidebar link
In `AppSidebar.tsx` line 160, change:
- `"Live Monitor"` → keep name, change `href: "/ceo"` to `href: "/live-monitor"`, change `allowedEmails` to `roles: ["admin", "office", "sales"]`

### 3. Add separate CEO Portal sidebar entry
Add a new sidebar item for the CEO Portal:
- Name: "CEO Portal", href: `/ceo`, icon: `BarChart3`, `allowedEmails: ["sattar@rebar.shop", "radin@rebar.shop"]`

### 4. Register the new route in `App.tsx`
Add `<Route path="/live-monitor" element={<P><LiveMonitor /></P>} />` alongside the existing `/ceo` route.

### 5. Update MobileNavV2
In `MobileNavV2.tsx`, keep "CEO Portal" entry for super admins and add "Live Monitor" for office/sales roles.

### 6. Update RoleGuard
Add `/live-monitor` to the `SALES_ALLOWED` and `WORKSHOP_ALLOWED` arrays as appropriate (sales managers need access).

### Files Changed

| File | Change |
|------|--------|
| `src/pages/LiveMonitor.tsx` | **New** — page wrapper for `LiveMonitorView` with role check |
| `src/App.tsx` | Add `/live-monitor` route |
| `src/components/layout/AppSidebar.tsx` | Split into two entries: "Live Monitor" → `/live-monitor` (roles), "CEO Portal" → `/ceo` (super admin emails) |
| `src/components/layout/MobileNavV2.tsx` | Add "Live Monitor" nav item for office/sales |
| `src/components/auth/RoleGuard.tsx` | Add `/live-monitor` to `SALES_ALLOWED` |

