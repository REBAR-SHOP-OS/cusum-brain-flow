

# Fix: CEO Portal Tab Shows Wrong Content

## Problem
Both the "CEO Portal" tab in Admin Panel and the `/ceo` route currently render `LiveMonitorView` (Shop Floor HUD). The actual CEO Dashboard (`CEODashboardView`) — with health score, KPI cards, exceptions workbench, AR aging, job risk, capacity forecast — exists but is **not used anywhere**. It was disconnected at some point.

## Solution

### 1. `src/pages/AdminPanel.tsx`
- Replace `LiveMonitorView` with `CEODashboardView` inside the "ceo-portal" tab content (line 345)
- Update import accordingly

### 2. `src/pages/CEOPortal.tsx`
- Replace `LiveMonitorView` with `CEODashboardView` for the `/ceo` route
- Update import accordingly

The Live Monitor remains accessible via its own dedicated "Live Monitor" tab in the Admin Panel — no functionality is lost.

