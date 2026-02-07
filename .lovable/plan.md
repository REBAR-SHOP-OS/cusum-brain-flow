
# Shop Floor v2 -- Station Production Views

## Overview
Build the v2 Shop Floor operator experience based on the reference screenshots. This creates three new views: a **Station Dashboard** (machine selector), a **Cutter Station UI** (cut engine with load selection), and a **Bender Station UI** (bending schematic with batch DONE flow). It also includes a **Pickup Station** and enhanced **Delivery Terminal** view.

This plan covers the core production operator interfaces. Clearance Hub, Team Hub, and Time Clock are future phases.

---

## What Gets Built

### 1. Database Changes
Add new columns to support production card data and pickup/delivery workflows:

**`cut_plan_items` -- new columns:**
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `mark_number` | text | null | Mark ID shown on cards (e.g. "A1014", "A2001") |
| `drawing_ref` | text | null | Drawing reference (e.g. "DWG# SD02") |
| `bend_type` | text | 'straight' | 'straight' or 'bend' -- determines card path |
| `asa_shape_code` | text | null | ASA shape reference number (e.g. "21", "17") |
| `total_pieces` | integer | 1 | Total pieces needed for this mark |
| `completed_pieces` | integer | 0 | Pieces completed so far |
| `needs_fix` | boolean | false | Flagged for review |
| `bend_dimensions` | jsonb | null | Shape dimension values (e.g. {"C":200,"H":650,"K":55,"D":650}) |
| `work_order_id` | uuid | null | Links item to a work order for project tracking |

**`cut_plans` -- new columns:**
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `project_name` | text | null | Project association shown in headers |
| `machine_id` | uuid | null | Which machine this plan is queued to |

**New table: `pickup_orders`**
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | uuid | gen_random_uuid() | Primary key |
| `company_id` | uuid | NOT NULL | Multi-tenant key |
| `customer_id` | uuid | null | FK to customers |
| `site_address` | text | NOT NULL | Pickup location (e.g. "952 Southdale Rd") |
| `bundle_count` | integer | 0 | Number of bundles for collection |
| `status` | text | 'pending' | 'pending', 'ready', 'collected', 'released' |
| `signature_data` | text | null | Base64 signature from "Tap to Sign" |
| `authorized_by` | uuid | null | Who authorized release |
| `authorized_at` | timestamptz | null | When release was authorized |
| `created_at` | timestamptz | now() | |
| `updated_at` | timestamptz | now() | |

RLS on `pickup_orders`: company_id scoped via `get_user_company_id(auth.uid())` for SELECT; admin/workshop for INSERT/UPDATE/DELETE.

**New table: `pickup_order_items`**
| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | uuid | gen_random_uuid() | Primary key |
| `pickup_order_id` | uuid | NOT NULL | FK to pickup_orders |
| `mark_number` | text | NOT NULL | e.g. "A1001" |
| `description` | text | null | Item details |
| `verified` | boolean | false | Checked off in manifest |

RLS: inherits through pickup_order's company_id join.

---

### 2. Station Dashboard (`/shopfloor/station`)
Full-screen landing page where operators select a machine to work on.

**Layout:**
- Dark header: "STATION DASHBOARD" with "CLOUD SYNCED / REAL-TIME ACTIVE" status indicator
- "ACTIVE PRODUCTION HUB" section: cards showing machines currently running, with project name, progress bar, and "ENTER STATION" button
- "SELECT FABRICATION UNIT" grid: all available machines as selectable cards (icon by type: cutter/bender/loader), showing machine name, model, and current status
- Clicking a machine navigates to `/shopfloor/station/:machineId`

**Data source:** Reuses `useLiveMonitorData` hook for machine list with real-time updates.

---

### 3. Cutter Station View (`/shopfloor/station/:machineId` when type=cutter)
Matches the "Cutter_UI" reference screenshot.

**Layout (split-panel):**
- **Header bar**: bar size badge (e.g. "10M"), "MARK A1029 | DWG# SD02", supervisor badge ("EXIT SUPERVISOR"), remaining count badge ("42 REMAINING")
- **Left panel (2/3 width):**
  - Large cut length display: giant number (e.g. "435") with "MM CUT LENGTH" subtitle
  - Below: ASA shape diagram (SVG) with dimension labels if bend_type is 'bend'
- **Right panel (1/3 width) -- "CUT ENGINE":**
  - Blue/dark background panel
  - "LOAD SELECTION" with stock length selector (6000mm / 12000mm / 18000mm segmented control)
  - Bars counter with increment/decrement arrows ("1 BARS")
  - "LOCK & START" button -- calls `manage-machine` with `start-queued-run` action
- **Navigation**: Back button returns to the reservoir/production cards list

**Behavior:**
- Items come from `cut_plan_items` linked through `cut_plans.machine_id` matching the selected machine
- Stepping through items one at a time (single-item focus view)
- "LOCK & START" validates via existing capability check in edge function, then marks the item as in-progress
- On completion, increments `completed_pieces` on the item

---

### 4. Bender Station View (`/shopfloor/station/:machineId` when type=bender)
Matches the "Bender_UI" reference screenshot.

**Layout (full-width single panel):**
- **Header**: "MARK A1014 | DWG# SD02 | BENDER B36", top-right badges ("NEXT PCS" / "COUNTER")
- **Shape diagram area**: Large ASA shape SVG with circled shape number (e.g. "21") and labeled dimension points (A, B, C, D, H, K)
- **Stats row (3 cards):**
  - BAR SIZE: "10M"
  - FINISHED PROGRESS: "0 / 6 PIECES MARKED" with progress percentage circle
  - MARK ID: "A1014"
- **Bending Schematic section**: Table-like list showing each dimension letter (C, H, K, D) with its value in mm, using large typography
- **Bottom bar**: Batch navigation ("< 1 >") with batch counter, and large green "DONE" button ("CONFIRMED +1 BARS")

**Behavior:**
- "DONE" button increments `completed_pieces` by 1 on the current `cut_plan_item`
- Batch navigation lets operator move between items in the queue
- Progress circle updates in real-time

---

### 5. Pickup Station (`/shopfloor/pickup`)
Two-level view matching the reference screenshots.

**Level 1 -- Pickup Station list:**
- Title: "PICKUP STATION"
- Dark cards showing pickup locations (e.g. "952 SOUTHDALE RD"), bundle count ("80 BUNDLES FOR COLLECTION"), status badge ("READY FOR PICKUP")
- Click a card to enter Level 2

**Level 2 -- Identity Verification Station:**
- Header: site address + "IDENTITY VERIFICATION STATION"
- Customer verification badge: company name from customers table
- Left panel: "HANDOVER MANIFEST" -- dark scrollable list of mark numbers with check icons
- Right panel: "COLLECTION AUTHENTICATION" -- signature pad area with "TAP TO SIGN"
- Bottom: Yellow "AUTHORIZE RELEASE" button
- On authorize: updates `pickup_orders.status` to 'released', stores signature data

---

### 6. Enhanced Delivery Terminal (`/deliveries/:deliveryId/terminal`)
Matches the "Delivery_UI" reference screenshot. Extends existing Deliveries page.

**Layout:**
- Header: Category name (e.g. "CAGES") + "JOBSITE DELIVERY TERMINAL"
- Unloading site label ("PICKUP") with "LAUNCH NAV" button (opens Google Maps with address)
- "SITE DROP PHOTO" capture area (dashed border, camera icon) -- uses device camera or file upload
- "CUSTOMER SIGN-OFF" area -- "TAP TO SIGN" signature pad
- "UNLOADING CHECKLIST" -- grid of items (e.g. C20, C21) with checkbox toggles
- Saving updates `delivery_stops` with `pod_photo_url` and `pod_signature`

---

### 7. ASA Shape SVG Component
A reusable component that renders common rebar bend shapes.

- Input: `shapeCode` (string like "21", "3", "17"), `dimensions` (object with labeled values)
- Renders an SVG with the shape outline and dimension labels at correct positions
- Initial implementation covers the ~10 most common ASA shapes
- Falls back to displaying the shape number in a circle if code is unrecognized

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/StationDashboard.tsx` | Machine selector landing page |
| `src/pages/StationView.tsx` | Router component that renders Cutter or Bender view based on machine type |
| `src/pages/PickupStation.tsx` | Pickup station list + verification |
| `src/components/shopfloor/StationHeader.tsx` | Shared header for station views |
| `src/components/shopfloor/CutterStationView.tsx` | Cutter UI with cut engine panel |
| `src/components/shopfloor/BenderStationView.tsx` | Bender UI with schematic + DONE flow |
| `src/components/shopfloor/CutEngine.tsx` | Blue "CUT ENGINE" panel component |
| `src/components/shopfloor/BendingSchematic.tsx` | Dimension list for bender view |
| `src/components/shopfloor/AsaShapeDiagram.tsx` | SVG renderer for ASA rebar shapes |
| `src/components/shopfloor/ProductionProgress.tsx` | Circular progress indicator |
| `src/components/shopfloor/MachineSelector.tsx` | Grid of machine cards for dashboard |
| `src/components/shopfloor/ActiveProductionHub.tsx` | Active jobs section on dashboard |
| `src/components/shopfloor/PickupVerification.tsx` | Manifest + signature + authorize UI |
| `src/components/shopfloor/SignaturePad.tsx` | "Tap to Sign" canvas component |
| `src/components/delivery/DeliveryTerminal.tsx` | Jobsite delivery terminal UI |
| `src/hooks/useStationData.ts` | Fetches production items for a machine, grouped by bar size |
| `src/hooks/usePickupOrders.ts` | CRUD hook for pickup_orders |

## Files to Edit

| File | Change |
|------|--------|
| `src/App.tsx` | Add routes: `/shopfloor/station`, `/shopfloor/station/:machineId`, `/shopfloor/pickup`, `/deliveries/:deliveryId/terminal` |
| `src/pages/ShopFloor.tsx` | Add navigation card/link to Station Dashboard |
| `src/components/layout/Sidebar.tsx` | No change needed (Shop Floor link covers sub-routes) |
| `src/hooks/useCutPlans.ts` | Update `CutPlanItem` interface with new columns |
| `src/types/machine.ts` | No changes needed (already has LiveMachine, QueuedRun) |

---

## Technical Details

### Routing Structure
```text
/shopfloor/station                --> StationDashboard (machine picker)
/shopfloor/station/:machineId     --> StationView (auto-detects cutter vs bender)
/shopfloor/pickup                 --> PickupStation (list + verification)
/deliveries/:deliveryId/terminal  --> DeliveryTerminal (driver terminal)
```

Existing routes remain unchanged: `/shopfloor/cutter`, `/shopfloor/live-monitor`.

### CutEngine Component Logic
- Stock length selector: 6000mm, 12000mm, 18000mm (standard rebar stock lengths)
- Bars counter: min 1, max from `machine_capabilities.max_bars` for the selected bar_code
- "LOCK & START": calls `manageMachine({ action: 'start-queued-run', machineId, runId, barCode, qty })`
- After start, transitions to a "running" state showing elapsed time

### Bender DONE Button Logic
- Each tap of DONE: `supabase.from('cut_plan_items').update({ completed_pieces: current + 1 }).eq('id', itemId)`
- When `completed_pieces >= total_pieces`, auto-advance to next item in queue
- Batch navigation: prev/next arrows cycle through items for the current bar size group

### ASA Shape Rendering
- Shape codes map to predefined SVG path data
- Dimension labels (A, B, C, D, H, K) positioned at shape endpoints
- Common shapes: straight (no bending), L-shape, U-shape, Z-shape, hook, stirrup, etc.
- Shape 21 from screenshots: appears to be a complex bent shape with 5+ dimension points

### Signature Pad
- Uses HTML Canvas for touch/mouse drawing
- Captures as base64 PNG string
- Stores in `pickup_orders.signature_data` or `delivery_stops.pod_signature`
- "TAP TO SIGN" placeholder shown when empty

### Real-time Updates
Both station views subscribe to `machine_runs` and `cut_plan_items` changes via existing Supabase Realtime channel pattern (same as `useLiveMonitorData`).

### Role-Based Access
- **Supervisor/Admin (canWrite)**: sees "EXIT SUPERVISOR" badge, LOCK & START button, DONE button, AUTHORIZE RELEASE
- **Workshop**: same as supervisor for production actions
- **Office**: read-only view, no action buttons, "VIEW ONLY" badge in header
