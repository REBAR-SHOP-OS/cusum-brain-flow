

# Auto-update `cut_plans.status` past `cut_done` when items finish bending / clearance

## Root cause

The existing trigger `auto_advance_plan_status` (migration `20260420185509`) only checks for two end states:

- `completed` — when **all** items have `phase='complete'`
- `cut_done` — when all items reached `cut_done` or beyond

But its "beyond" set is `('cut_done', 'bending', 'bend_done', 'complete')` — **`clearance` is missing**, and there's no `bend_complete` status to represent "bending finished, awaiting QC clearance."

Live evidence: plan **Rebar Cage (Small)** has its item in `phase='clearance'` but plan `status` is still `'cut_done'`, so the Production Queue keeps showing the stale "Cut Done — Awaiting Bend" badge.

## Fix — one migration + one UI label addition

### A) Migration: add `bend_complete` status + smarter trigger

1. **Extend `validate_cut_plan_status`** to allow `'bend_complete'`:
   ```
   IN ('draft', 'queued', 'running', 'cut_done', 'bend_complete', 'completed', 'canceled')
   ```

2. **Rewrite `auto_advance_plan_status`** with a richer phase ladder:
   - `v_all_complete` = items with `phase='complete'`
   - `v_all_bend_or_beyond` = items with `phase IN ('bend_done', 'clearance', 'complete')` **OR** (`bend_type='straight'` AND `phase='complete'`)
   - `v_all_cut_or_beyond` = items with `phase IN ('cut_done', 'bending', 'bend_done', 'clearance', 'complete')`
   - Has-bend flag = items with `bend_type='bend'`

   Decision ladder:
   - All `complete` → `'completed'`
   - All bend-or-beyond AND has bend items → `'bend_complete'` (bending finished, awaiting clearance)
   - All cut-or-beyond AND has bend items → `'cut_done'`
   - All cut-or-beyond AND no bend items → `'completed'`
   - Otherwise → leave unchanged

3. **Backfill**: re-run `UPDATE cut_plan_items SET phase=phase WHERE id=...` per plan to fire the trigger and recompute every existing plan's status (same idiom already used in the original migration).

The trigger keeps firing on `AFTER INSERT OR UPDATE OF phase` — no signature change.

### B) UI: add `bend_complete` label in `ShopFloorProductionQueue.tsx`

In the `StatusBadge` map (line 460–469), add:
```ts
bend_complete: { label: "Bent — Awaiting QC", cls: "bg-primary/20 text-primary" },
```
Existing `cut_done` and `completed` entries stay the same. No other UI touched.

## Scope

**Changes:**
- New migration file (single SQL): redefine `validate_cut_plan_status` + `auto_advance_plan_status` + backfill loop
- `src/components/shopfloor/ShopFloorProductionQueue.tsx`: add one map entry for `bend_complete`

**Untouched:**
- `cut_plan_items.phase` enum / `auto_advance_item_phase` trigger
- All bender / cutter dashboards, hooks, RLS, queues, batches
- Pro Editor, AdDirector, any unrelated module

## Validation

- ✅ Plan **Rebar Cage (Small)** auto-flips from `cut_done` → `bend_complete` (item in clearance) immediately after migration backfill
- ✅ When the clearance item is approved → `phase='complete'` → trigger flips plan to `'completed'`
- ✅ A plan with mixed items (some still `cutting`) stays `'running'` / `'cut_done'` — no regression
- ✅ Straight-only plans (no bend) still go straight `running → completed`
- ✅ Production Queue badge for the affected plan reads "Bent — Awaiting QC" instead of stale "Cut Done — Awaiting Bend"
- ✅ No DB schema changes beyond a string value in the validation whitelist

