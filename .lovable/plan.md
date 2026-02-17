
# CRM Stage Reordering (Admin-Only) + Delete Permission Enforcement

## Overview
Two surgical changes:
1. **Admin-only drag-to-reorder CRM stages** with persistent storage visible to all users
2. **Admin-only delete enforcement** at both UI and API level, with no delete button for non-admins

---

## Part 1: Reorderable CRM Stages

### Current State
- `PIPELINE_STAGES` is a hardcoded array in `src/pages/Pipeline.tsx` (28 stages)
- Stage order is identical for all users, fixed at build time
- No database table for stage ordering

### Plan

**A. New database table: `pipeline_stage_order`**

```sql
CREATE TABLE public.pipeline_stage_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  stage_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id)
);

ALTER TABLE public.pipeline_stage_order ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (same order visible to all)
CREATE POLICY "All users can read stage order"
  ON public.pipeline_stage_order FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Only admins can update
CREATE POLICY "Admins can upsert stage order"
  ON public.pipeline_stage_order FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

The `stage_order` column stores an array of stage IDs (e.g., `["prospecting","new","telephonic_enquiries",...]`). If no row exists or the array is empty, the app falls back to the hardcoded default order.

**B. New hook: `src/hooks/usePipelineStageOrder.ts`**

- Fetches `pipeline_stage_order` for the user's company
- Merges with hardcoded `PIPELINE_STAGES` (handles new stages not yet in saved order)
- Returns `orderedStages` array + `saveOrder(newOrder)` mutation (admin-only)
- Includes a `canReorder` flag based on `isAdmin`

**C. Update `src/pages/Pipeline.tsx`**

- Import and use `usePipelineStageOrder()` instead of raw `PIPELINE_STAGES`
- Pass `orderedStages` to `PipelineBoard`
- No other logic changes

**D. Update `src/components/pipeline/PipelineBoard.tsx`**

- Accept `canReorder` prop (boolean)
- When `canReorder` is true, add drag-and-drop on column HEADERS only (separate from card DnD)
- Column header gets a grip icon and `draggable` when admin
- On column drop: call `saveOrder()` with the new stage ID array
- Throttle: save is debounced (500ms) to prevent rapid-fire DB writes
- Non-admins see no grip icon, columns are not draggable

---

## Part 2: Admin-Only Delete + Archive for Non-Admins

### Current State
- `LeadDetailDrawer.tsx` line 249: already checks `isAdmin` before showing delete button (good)
- `Pipeline.tsx` line 289-293: `handleDelete` uses raw `window.confirm()` -- accessible to anyone who calls it
- `PipelineColumn.tsx` and `LeadCard.tsx`: pass `onDelete` prop down but never render a delete button on the card itself (delete is only in the drawer)
- No RLS policy blocking non-admin deletes on `leads` table

### Plan

**A. Add RLS policy: admin-only DELETE on `leads`**

```sql
CREATE POLICY "Only admins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

This is the server-side guard -- even if UI is bypassed, non-admins cannot delete.

**B. Update `src/pages/Pipeline.tsx`**

- Import `useUserRole`
- Gate `handleDelete`: add early return with toast if `!isAdmin`
- Replace `window.confirm` with `AlertDialog` (per project safety standard)
- The `onDelete` prop still flows through to components but is a no-op for non-admins

**C. Update `src/components/pipeline/LeadDetailDrawer.tsx`**

- Already has `isAdmin` check on delete button -- keep as-is
- Replace `window.confirm("Delete this lead?")` with `AlertDialog` (per `ui/safety-guards-standard` memory)

**D. Archive option for non-admins (lightweight)**

- In `LeadDetailDrawer.tsx`, when `!isAdmin`, show an "Archive" button that moves the lead to a terminal stage (e.g., `"lost"` or a new `"archived"` stage)
- This is a stage change, not a delete -- uses existing `onStageChange` mechanism
- No new database changes needed

---

## Files Modified

| File | Change |
|---|---|
| **Database migration** | Create `pipeline_stage_order` table + RLS; add admin-only DELETE policy on `leads` |
| `src/hooks/usePipelineStageOrder.ts` | **New** -- fetch/save stage order, merge with defaults |
| `src/pages/Pipeline.tsx` | Use `usePipelineStageOrder`; gate `handleDelete` with admin check + AlertDialog |
| `src/components/pipeline/PipelineBoard.tsx` | Add column-header drag-and-drop for admin reordering |
| `src/components/pipeline/LeadDetailDrawer.tsx` | Replace `confirm()` with AlertDialog; add Archive button for non-admins |

## Guards and Safety

- **Throttling**: Stage order saves debounced at 500ms
- **Fallback**: If `pipeline_stage_order` row is missing/empty, hardcoded defaults are used
- **Merge logic**: New stages added to code but not in saved order are appended at the end
- **RLS**: Server-side enforcement for both delete and stage order writes
- **AlertDialog**: All destructive actions use AlertDialog (no `window.confirm`)
- **No domino effects**: `PIPELINE_STAGES` constant remains exported for backward compatibility (other files import it); the hook wraps it
