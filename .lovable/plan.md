## Goal

In the Work Order Queue (Station Dashboard), clicking **Start** on a WO should:
- auto-assign every one of its production tasks to the first **idle** machine of the matching type,
- make those tasks show up in **Active Production** and on the **machine cards** (running pill),
- flip the WO to `in_progress`.

Clicking **Pause** on a running WO should:
- send the tasks back to the queue on the **same machine** (status `queued`, position kept, `qty_completed` untouched),
- flip the WO to `on_hold`.

Today, the Start/Pause buttons only flip `work_orders.status`. They never touch `machine_queue_items` or `production_tasks`, which is why nothing appears under Active Production or on machine cards.

## What changes

### 1. New helper — `src/lib/workOrderDispatch.ts`

Pure service module, no UI. Two functions:

```text
startWorkOrder(workOrderId)
  - load production_tasks for WO where status in ('pending','queued','on_hold')
  - load machines for company (id, type, status)
  - map task_type -> machine.type:
      'cut'    -> 'cutter'
      'bend'   -> 'bender'
      'spiral' -> 'bender' (fallback)
      other    -> first idle of any type
  - for each task:
      pick first IDLE machine of matching type (round-robin within the call so we don't
        cram every task on the same machine when multiple are idle)
      upsert machine_queue_items by task_id:
        - if row exists (queued/running): UPDATE status='running', machine_id, updated_at
        - else: INSERT row (company_id, task_id, machine_id, work_order_id,
          project_id = work_order_id, status='running', position = max(position)+1)
      UPDATE production_tasks.status = 'in_progress'
  - return { ok, assigned: [{taskId, machineId}], skipped: [...] }

pauseWorkOrder(workOrderId)
  - UPDATE machine_queue_items SET status='queued'
      WHERE work_order_id = $1 AND status = 'running'
      (machine_id + position preserved — progress kept)
  - UPDATE production_tasks SET status='pending'
      WHERE work_order_id = $1 AND status = 'in_progress'
  - return { ok }
```

Notes:
- Unique index `idx_queue_task_active` already enforces one active row per task → safe to upsert.
- No schema change needed; existing RLS (`Admin/workshop can manage queue items`) already governs writes.
- `qty_completed` lives on `production_tasks` and is never touched here, so progress survives Pause.

### 2. `useSupabaseWorkOrders` — extend the hook

Add two methods alongside `updateStatus`:

```text
startWorkOrder(wo): calls workOrderDispatch.startWorkOrder, then updateStatus(wo, 'in_progress')
                   invalidates ['production-queues'], ['station-data'], ['work-orders']
pauseWorkOrder(wo): calls workOrderDispatch.pauseWorkOrder, then updateStatus(wo, 'on_hold')
                   same invalidations
```

Keep `updateStatus` as-is (still used for Complete).

### 3. `WorkOrderQueueSection.tsx` — wire the buttons

- `Start` button → `onStart(wo)` (was `onUpdateStatus(wo.id, 'in_progress')`)
- `Pause` button → `onPause(wo)` (was `onUpdateStatus(wo.id, 'on_hold')`)
- `Complete` button → unchanged (`onUpdateStatus(wo.id, 'completed')`)
- Toast on Start: "Started — assigned to N machine(s)" or "No idle machines available" when nothing got assigned.

Update prop types accordingly; `StationDashboard` passes the new handlers from the hook.

### 4. Failure & edge cases

- WO has zero tasks → toast "No tasks to dispatch", do NOT flip WO to in_progress.
- No idle machine of the required type → leave that task in `queued` on the closest idle machine of any type; if none at all, toast "All machines busy — queued"; still flip WO to in_progress only if at least one task was placed running.
- RLS failure on queue insert → roll back WO status optimistic update, surface "Failed to dispatch — check permissions".
- Pause when no running queue rows exist → still flip WO to on_hold (idempotent).

## Verification

- Click Start on a WO with cut + bend tasks → row appears in Active Production with the WO name, and the matching CUTTER and BENDER machine cards show a running task.
- Click Pause → row disappears from Active Production, machine cards return to idle, WO chip flips to ON HOLD, but `qty_completed` on the tasks is unchanged (verify via a quick DB read).
- Click Start again → same machines pick it back up (position preserved).

## Files touched

- `src/lib/workOrderDispatch.ts` (new)
- `src/hooks/useSupabaseWorkOrders.ts` (add startWorkOrder, pauseWorkOrder)
- `src/components/shopfloor/WorkOrderQueueSection.tsx` (button wiring + props)
- `src/pages/StationDashboard.tsx` (pass new handlers)

No DB migration, no new tables, no RLS changes.
