

## Create All Portals

This plan covers 4 role-based portals. Each is scoped to the minimum viable version to avoid UI bloat.

---

### Current State

| Portal | Status | Notes |
|--------|--------|-------|
| Admin Portal | EXISTS at `/admin` | PIN-locked, employee mgmt + CEO dashboard |
| Workshop Portal | EXISTS at `/shop-floor` | Hub with stations, cutter, clearance, pickup |
| Driver Portal | EXISTS at `/deliveries` | Delivery list + stops, POD fields exist in schema |
| Office Tools | EXISTS at `/office` | Full sidebar with 12 modules |
| Customer Portal | MISSING | No external-facing order/delivery tracking |

---

### What Actually Needs Building

**Portal 1: Customer Portal (NEW)** -- the only truly missing piece.

A public-facing, login-gated portal where external customers can:
- View their orders and order status
- Track deliveries assigned to them
- Download packing slips / documents
- No editing capability (read-only)

**Portal 2: Workshop Portal (ENHANCE)**

The `/shop-floor` hub exists but lacks a unified "My Shift" view for workers. Add:
- A "My Jobs" card on the hub showing tasks assigned to the logged-in user
- Quick clock-in/out button (links to `/timeclock`)

**Portal 3: Driver Portal (ENHANCE)**

`/deliveries` exists but is office-oriented. Add:
- A "Driver Mode" toggle that filters to only the logged-in driver's deliveries
- POD capture button (photo upload + signature) on each stop card
- Issue logging button per stop

**Portal 4: Admin Portal (NO CHANGES)**

Already complete with employee management, CEO dashboard, and PIN lock.

---

### Technical Plan

#### Step 1: Customer Portal (new page + new route)

**Database:**
- Add `customer_portal_tokens` table: `id`, `customer_id` (FK customers), `token_hash`, `expires_at`, `created_at`
- RLS: service-role only (tokens validated via edge function)
- OR simpler approach: use existing Supabase auth with a `customer` role in `user_roles`

**Files:**
- `src/pages/CustomerPortal.tsx` -- new page with order list, delivery tracking
- `src/components/customer-portal/CustomerOrderList.tsx` -- read-only order cards
- `src/components/customer-portal/CustomerDeliveryTracker.tsx` -- delivery status timeline
- `src/hooks/useCustomerPortalData.ts` -- fetches orders + deliveries for logged-in customer
- Route: `/portal` (public layout, no AppLayout sidebar)

**RLS:**
- New policy on `orders`: customers can SELECT where `customer_id` matches their linked customer record
- New policy on `deliveries`: customers can SELECT deliveries linked to their orders
- New policy on `delivery_stops`: customers can SELECT stops for visible deliveries

#### Step 2: Workshop "My Jobs" Enhancement

**Files:**
- `src/components/shopfloor/MyJobsCard.tsx` -- shows production_tasks assigned to current user
- Edit `src/pages/ShopFloor.tsx` -- add MyJobsCard above the hub grid

**Data:** Uses existing `production_tasks` + `machine_queue_items` filtered by `assigned_to` matching current user profile.

#### Step 3: Driver Mode Enhancement

**Files:**
- Edit `src/pages/Deliveries.tsx` -- add "Driver Mode" toggle that filters by `driver_name` matching current user
- `src/components/delivery/PODCaptureDialog.tsx` -- photo upload + signature capture for delivery stops
- `src/components/delivery/StopIssueDialog.tsx` -- log exceptions per stop

**Data:** Uses existing `delivery_stops.pod_signature`, `pod_photo_url`, `exception_reason` columns. No schema changes needed.

---

### Sequencing

1. Customer Portal (new page, new auth flow, new RLS) -- largest piece
2. Workshop "My Jobs" card -- small, self-contained
3. Driver Mode + POD capture -- medium, extends existing page
4. Admin Portal -- no changes needed

### What This Does NOT Include
- No new database collections/tables beyond `customer_portal_tokens` (if token approach chosen)
- No ERP grids or HR modules
- No changes to existing Office Tools or Admin Portal
- No mobile app (PWA already configured)

