## Fix Cutter Station "No tasks to dispatch" bug

### Root cause (confirmed in DB)

For `WO-MPO4ZAZD`:

- `work_orders.status = 'pending'`, linked to barlist `af34e45b…`
- `cut_plans` for that barlist exists (`Bar marks as per Sina's request`, status `completed`) with 6 `cut_plan_items` (AS01, AS02, AS03, AS04, A1502 — visible in screenshot 2)
- `production_tasks WHERE work_order_id = …` → **0 rows**

`src/lib/workOrderDispatch.ts:51-53` exits early with `"No tasks to dispatch"` when zero `production_tasks` are found. That message becomes the toast `"Failed to start — No tasks to dispatch WO-MPO4ZAZD"` in screenshot 1.

Two distinct problems are fused in this WO:
1. **Missing tasks for genuinely pending cuts** (no hydration step from `cut_plan_items` to `production_tasks`).
2. **Misleading message for items that are already past cutting** (AS01-AS04 are `phase='clearance'`, A1502 is `complete`; this WO has nothing left for a cutter to do, but the UI doesn't say so).

### Fix — surgical, additive only

#### 1. `src/lib/workOrderDispatch.ts` — `startWorkOrder()`

When zero `production_tasks` are returned, **don't fail immediately**. Run a hydration fallback:

1. Load the WO (`id, status, barlist_id, project_id, order_id`).
2. If `status` is already `in_progress`, return `{ ok:false, reason: "Work order is already running" }`.
3. Find candidate `cut_plan_items` for this WO:
   - Via the WO's `barlist_id` → `cut_plans.id` → `cut_plan_items`
   - Filter `phase IN ('queued', 'cutting')` and `total_pieces > 0`
   - This excludes items already in `clearance` / `complete`.
4. If candidates is **empty**, return one of:
   - "Work order has no production items" — when WO has no cut_plan_items at all
   - "All cuts already complete — nothing to dispatch" — when cut_plan_items exist but all are past `cutting`
5. If candidates **exist**, insert `production_tasks` rows (one per item) with:
   - `company_id`, `work_order_id`, `cut_plan_id`, `cut_plan_item_id`, `barlist_id`, `project_id`, `order_id`
   - `task_type = 'cut'` (since these are straight-cut items in the cutter pool)
   - `bar_code`, `mark_number`, `drawing_ref`, `cut_length_mm`, `unit_system` copied from the cut_plan_item
   - `qty_required = total_pieces`, `qty_completed = 0`
   - `status = 'pending'`, `priority = 100`
   - Idempotency: skip insert when a `production_tasks` row already exists for `(work_order_id, cut_plan_item_id)` (defensive — should be impossible since we just confirmed zero exist, but covers a race).
6. Re-load tasks and continue with the existing dispatch flow (machine pick → `machine_queue_items` upsert → tasks → `in_progress`).

If after the existing machine-pick loop `assigned === 0` because no cutter is idle, keep the current `"No idle machines available"` reason but enrich it:
- `"No idle cutter machines available"` when the picked machine type was `cutter`.

#### 2. Debug logs (as user requested)

Add `console.debug("[startWorkOrder]", { workOrderId, barlistId, productionTasks: n, eligibleCutItems: m, blockedReason })` at the decision points. No PII, no secrets.

#### 3. UI — replace generic toast

`src/components/shopfloor/WorkOrderQueueSection.tsx:213` already surfaces `r.reason`. **No code change** required there once `workOrderDispatch.ts` returns specific reasons. The "No tasks to dispatch" string is removed from the codebase.

### What this does NOT change

- `pauseWorkOrder` — untouched.
- `production_tasks` schema — no migration. The columns we insert (`company_id`, `work_order_id`, `cut_plan_id`, `cut_plan_item_id`, `bar_code`, `mark_number`, `drawing_ref`, `cut_length_mm`, `unit_system`, `task_type`, `qty_required`, `qty_completed`, `status`, `priority`) all exist on the table (verified via `\d production_tasks`).
- Workflow hard gates — items in `clearance` / `complete` are explicitly excluded from hydration, so no completed item is restarted, no clearance gate is bypassed.
- RLS — uses the user's session like every other call in `workOrderDispatch.ts`.
- Manual cutter station flow (start/stop inside `CutterStationView`) — unchanged.
- Cutter station detail page rendering — unchanged.
- `ProductionQueuePanel` and `ActiveProductionPanel` UI — unchanged; they already consume the same `work_orders` + `production_tasks` source.

### Files touched

- `src/lib/workOrderDispatch.ts` — hydration fallback, specific reasons, debug logs

### Test checklist

1. On `WO-MPO4ZAZD` (current state — all items in `clearance`/`complete`), click **Start** → toast should now read `"All cuts already complete — nothing to dispatch"` instead of `"No tasks to dispatch"`.
2. On a fresh WO that has `cut_plan_items` with `phase='queued'` and no `production_tasks`, click **Start** → tasks are created, machine_queue_items get a running row, WO status flips to `in_progress`, item appears in **Active Production**.
3. On a WO already `in_progress`, click **Start** → toast `"Work order is already running"`.
4. On a cutter-only WO when all cutters are busy on other WOs, click **Start** → toast `"No idle cutter machines available"`.
5. Manual cutting at `/shopfloor/station/:id` still starts/completes a queued cut as before (no regression).
