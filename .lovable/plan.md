

# Loading Station: Item-by-Item Truck Loading with Evidence

## Problem

The current workflow jumps directly from "Cleared bundle" to "Create Delivery" without a loading verification step. There is no way for the loader to:
- Check off each mark number as it's loaded onto the truck
- Take a photo of each item being loaded (evidence)
- Track loading progress before creating the delivery and packing slip

The `loading_evidence` table exists in the database but has no dedicated UI -- it's only accessible from the office PackingSlipsView.

## Solution

Add a **Loading Station** page between Clearance and Delivery. The operator selects a cleared bundle, then loads items one by one: tap an item to mark it loaded, optionally snap a photo. Once all items are checked, the "Create Delivery" button activates.

## Workflow

```text
Clearance (complete) --> Loading Station
  --> Select bundle
  --> Item list with checkboxes
  --> Tap item --> mark loaded (+ optional photo evidence)
  --> Progress bar: 12/23 loaded
  --> All loaded --> "Create Delivery" button activates
  --> Creates delivery + packing slip (existing logic)
  --> Redirects to Deliveries page
```

## Changes

### 1. Database: New `loading_checklist` table

Track per-item loading status for a delivery preparation session:

| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK | RLS scope |
| cut_plan_id | uuid FK | Which bundle |
| cut_plan_item_id | uuid FK | Which specific item |
| loaded | boolean | Checked off |
| photo_path | text | Optional evidence photo path |
| loaded_by | uuid | Who loaded it |
| loaded_at | timestamptz | When |
| created_at | timestamptz | |

RLS: company_id scoped, same pattern as other tables.

### 2. New Page: `src/pages/LoadingStation.tsx`

- Header: "LOADING STATION" with back button to shop floor
- Shows list of cleared bundles (reuses `useCompletedBundles`)
- On bundle select: shows item checklist
- Each item row shows: mark number, bar code, cut length, pieces, and a checkbox + camera button
- Tapping checkbox marks item as loaded in `loading_checklist`
- Camera button opens file picker, uploads photo to `clearance-photos` bucket, saves path to `loading_checklist.photo_path`
- Progress bar at top: "12/23 items loaded"
- "Create Delivery" button at bottom, disabled until all items checked
- On "Create Delivery": calls existing `createDeliveryFromBundle`, then navigates to `/deliveries`

### 3. Route + Navigation

- Add route `/shopfloor/loading` in `App.tsx`
- Add "LOADING ST." card back to `ShopFloor.tsx` hub pointing to `/shopfloor/loading` (previously removed because it was a duplicate to `/deliveries` -- now it has its own page)
- Update the `complete` phase action in `PoolView.tsx` to point to `/shopfloor/loading` instead of `/deliveries`

### 4. Update Deliveries Page

- Remove the bundle selection / "Create Delivery" flow from `Deliveries.tsx` since loading now happens at the Loading Station
- Keep the delivery list, driver mode, POD capture, and packing slip archive as-is

## Files

| File | Change |
|---|---|
| Database migration | Create `loading_checklist` table with RLS |
| `src/pages/LoadingStation.tsx` | **New** -- loading station with item checklist, photo evidence, progress bar |
| `src/hooks/useLoadingChecklist.ts` | **New** -- hook for reading/writing loading checklist items |
| `src/App.tsx` | Add route `/shopfloor/loading` |
| `src/pages/ShopFloor.tsx` | Add "LOADING ST." card pointing to `/shopfloor/loading` |
| `src/pages/PoolView.tsx` | Update "complete" phase action route from `/deliveries` to `/shopfloor/loading` |
| `src/pages/Deliveries.tsx` | Remove bundle selection panel (loading now handled upstream) |
