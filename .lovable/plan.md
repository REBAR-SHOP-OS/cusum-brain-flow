## Problem

Clearance "Manual Verify" fails with `WORKFLOW_GATE_ADJACENCY: cut_plan_items clearance → complete not allowed`.

## Root cause

`src/components/clearance/ClearanceCard.tsx` line 261 updates `cut_plan_items.phase` to `'complete'` after evidence is cleared. But the DB adjacency trigger (migration `20260527202349…`) only allows:

```
clearance → cleared
cleared   → zoned | loading | complete
```

So the legal next phase from `clearance` is `cleared`, not `complete`. The trigger then auto-advances onward.

## Fix (single line, frontend only)

In `src/components/clearance/ClearanceCard.tsx` `handleVerify`:

- Change `.update({ phase: "complete" })` → `.update({ phase: "cleared" })`.

That matches the evidence row's `status: "cleared"` written immediately above, and satisfies the adjacency gate. Downstream auto-advance / loading station picks it up from `cleared` as designed.

## Scope guardrails

- No migrations, no role changes, no trigger edits.
- No LoadingStation / PickupStation changes.
- No new business logic — just correcting the target phase value to the one the DB already accepts.

## Verification

- Reload `/home` → Clearance → Manual Verify on A1501E / A1002: toast becomes "Item cleared", red gate banner disappears, item moves off clearance manifest.
- Existing `tests/regression/workflow-gate/*` stay green (no production logic they mirror has changed).
