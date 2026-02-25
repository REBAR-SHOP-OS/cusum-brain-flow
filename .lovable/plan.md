

## Fix: "Production blocked: shop drawing not approved" Error on Complete Run

### Root Cause

In `CutterStationView.tsx` line 310, when completing a run, the code always sets `phase: "cutting"`:

```typescript
.update({
  completed_pieces: newCompleted,
  phase: "cutting",  // ← ALWAYS sets this
})
```

If the item's current phase is `queued` (which it is for all BS09 items), this triggers the `block_production_without_approval` database trigger, which checks:
- `shop_drawing_status` on the linked order → currently `draft`
- `qc_internal_approved_at` → currently `null`

The trigger correctly raises: `"Production blocked: shop drawing not approved (status: draft)"`

The order `ORD-MM2MM060` genuinely has `shop_drawing_status = 'draft'` and `qc_internal_approved_at = NULL` in the database. So the trigger is working as designed — but the shop floor is already running production, creating a conflict.

### Two-Part Fix

**1. `src/components/shopfloor/CutterStationView.tsx` (line 306-312)**

Stop forcing `phase: "cutting"` on complete. The `auto_advance_item_phase` trigger already handles phase advancement based on `completed_pieces`. Just update `completed_pieces` and let the trigger do its job:

```typescript
// Before:
.update({
  completed_pieces: newCompleted,
  phase: "cutting",  // trigger will auto-advance
})

// After:
.update({
  completed_pieces: newCompleted,
})
```

This removes the `queued → cutting` transition that fires the blocking trigger. The `auto_advance_item_phase` trigger will advance from `queued` → `cut_done`/`complete` directly when pieces are done.

**2. Database trigger `block_production_without_approval`**

Relax the trigger to only block the FIRST transition into cutting (i.e., when starting to cut), not when items are being completed. The real gate should be at run start, not run completion. Update the trigger condition:

```sql
-- Only block when moving INTO cutting from a non-production phase
IF NEW.phase = 'cutting' AND OLD.phase = 'queued' THEN
```

This is actually already handled by fix #1 (not setting phase to cutting on complete). But as a safety net, also add a bypass when the item already has completed pieces (production already started):

```sql
IF NEW.phase = 'cutting' AND (OLD.phase IS DISTINCT FROM 'cutting') 
   AND COALESCE(OLD.completed_pieces, 0) = 0 THEN
```

### Changes Summary

| File | Change |
|------|--------|
| `src/components/shopfloor/CutterStationView.tsx` | Remove `phase: "cutting"` from the complete-run update — let the auto-advance trigger handle phase transitions |
| DB migration | Update `block_production_without_approval` to skip check when `OLD.completed_pieces > 0` (production already underway) |

### Technical Details

- The `auto_advance_item_phase` trigger (on `cut_plan_items` BEFORE UPDATE) already handles: if `completed_pieces >= total_pieces` and phase is `queued` or `cutting`, advance to `cut_done` (if bend) or `complete` (if straight)
- By removing the explicit `phase: "cutting"`, we avoid the blocking trigger entirely — the only phase change comes from auto-advance, which transitions to `cut_done`/`complete`, not to `cutting`
- The DB trigger change is a safety net: if any other code path sets `phase = cutting`, it won't block items that already have production progress
- No data loss risk — `completed_pieces` still gets persisted correctly

