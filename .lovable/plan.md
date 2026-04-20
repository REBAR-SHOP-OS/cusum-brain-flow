

# Surface "cleared / ready-to-ship" items in Logistics so finished work is never invisible

## Problem
When an item finishes Clearance Station (`phase = 'complete'`), it disappears from the shop-floor screens but does **not** automatically appear in any Logistics queue (Pickup, Loading, Delivery). The "Rebar Cage" pieces (A2001 straight) and the just-cleared "Rebar Cage (Small)" pieces (A1003) are sitting in this gap — physically done, digitally invisible.

Root cause: `cut_plan_items.phase = 'complete'` is the **end of production**, but there is no trigger that promotes those finished pieces into a logistics-staging bucket. Logistics screens read from `deliveries` / `loading_lists` / `pickups`, which only get populated when an office user manually creates a delivery or pickup ticket.

## Goal
Every item that reaches `phase = 'complete'` must be visible in **one** of: Pickup, Loading, or Delivery — with a sensible default — and operators must be able to move it between those three buckets from one screen.

## Solution (two layers — DB + UI)

### Layer 1 — DB: auto-stage cleared items into a "ready" bucket
Add a new column and trigger so finished items land in a logistics holding area automatically:

1. Add `cut_plan_items.fulfillment_channel` enum (`pickup` | `loading` | `delivery` | `null`) with default `null`.
2. Add `cut_plan_items.ready_at timestamptz` set automatically when `phase` transitions to `complete`.
3. Extend the existing `auto_advance_item_phase` trigger: on transition into `complete`, copy the parent project's default channel (from `projects.default_fulfillment_channel`, falling back to `'pickup'`) into `fulfillment_channel` and stamp `ready_at = now()`. No data is destroyed; no existing rows change behavior.
4. Add `projects.default_fulfillment_channel` (same enum, default `'pickup'`) so each project can pre-route its finished bundles.

### Layer 2 — UI: a single "Ready to Ship" board with three tabs

New section on `/logistics` (and a card on the Station Dashboard called **Ready to Ship — N items**):

```text
┌─ Ready to Ship ────────────────────────────────────────────┐
│ [ Pickup (4) ] [ Loading (2) ] [ Delivery (7) ]   ⚙ filter │
├────────────────────────────────────────────────────────────┤
│ Innis College  ·  Rebar Cage          A2001  20M  30 pcs   │
│   Cleared 2 min ago    [→ Loading] [→ Delivery] [Stage]    │
│ Innis College  ·  Rebar Cage (Small)  A1003  10M  25 pcs   │
│   Cleared just now     [→ Loading] [→ Delivery] [Stage]    │
└────────────────────────────────────────────────────────────┘
```

Behavior:
- Each row is a `cut_plan_items` record where `phase = 'complete'` AND no `delivery_id` / `loading_list_id` / `pickup_id` is attached yet.
- The two arrow buttons re-assign `fulfillment_channel`. **Stage** opens the existing "Create Delivery / Loading List / Pickup" dialog pre-filled with the item.
- Once the operator creates a real delivery/loading/pickup ticket, the item drops off this board and shows up in the existing Logistics flow — no double-handling.

### Layer 3 — Dashboard signal (small)
On the Station Dashboard, add a **Ready** badge next to the existing "Done" badge so the difference between "cut finished but no logistics action" and "shipped" is visible at a glance. Pure UI, reads the same `phase = 'complete' AND delivery_id IS NULL` predicate.

## Files touched

**DB migration (new):**
- Add columns + enum + trigger update described above
- Backfill existing `phase = 'complete'` rows with `fulfillment_channel = 'pickup'` and `ready_at = updated_at` so today's "lost" items (A2001 etc.) appear immediately

**Frontend (new + light edits):**
- `src/components/logistics/ReadyToShipBoard.tsx` (new) — three-tab board with row actions
- `src/hooks/useReadyToShip.ts` (new) — query + realtime subscription on `cut_plan_items`
- `src/pages/Logistics.tsx` — mount the new board above existing sections
- `src/pages/StationDashboard.tsx` — add "Ready to Ship — N" summary card linking to `/logistics#ready`
- `src/components/shopfloor/ActiveProductionHub.tsx` — add the "Ready" badge on each row

**Untouched:**
- `useClearanceData.ts`, Clearance Station UI, `auto_advance_item_phase` core flow (only extended, not replaced)
- Existing deliveries / loading_lists / pickups tables and screens
- RLS — new columns inherit existing `cut_plan_items` policies

## Validation

- ✅ A2001 (Rebar Cage, 30 pcs straight) appears under **Ready to Ship → Pickup** within seconds of the migration running
- ✅ A1003 (Rebar Cage Small, 25 pcs) will appear in the same board as soon as the operator finishes the clearance step on the screen they're on now
- ✅ Re-routing an item from Pickup to Delivery updates `fulfillment_channel` and reflects in real time on every open dashboard (Realtime subscription on `cut_plan_items`)
- ✅ Creating an actual delivery/loading list/pickup from the row removes it from the board (it's now tracked downstream)
- ✅ No regression to Clearance, Cutting, or any existing Logistics ticket flow

## Out of scope
- Auto-creating actual delivery tickets (still requires an office user to confirm address/truck/date)
- Customer notifications / SMS — separate feature
- Changing the production phase model (`queued → cutting → bending → clearance → complete` stays exactly as-is)

