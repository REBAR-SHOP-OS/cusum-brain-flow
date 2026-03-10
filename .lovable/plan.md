

# Phase 2: Cut Batch, Waste Bank, Hard Job Lock, Active State Persistence

## Current State
- Phase 1 added `active_job_id`, `cut_session_status`, `job_assigned_by` columns to `machines` (schema only — not yet enforced)
- `manage-machine` edge function handles start-run/complete-run but does NOT set these lock columns
- `CutterStationView.tsx` manages run state entirely in React state (lost on refresh)
- No `cut_batches` or `waste_bank_pieces` tables exist
- The optimizer in `manage-extract` already penalizes locked machines but doesn't hard-block them

## Changes

### Migration 1: Create `cut_batches` table
```sql
CREATE TABLE public.cut_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  source_plan_id uuid,
  machine_id uuid REFERENCES public.machines(id),
  machine_run_id uuid,
  cut_plan_item_id uuid,
  bar_code text,
  planned_qty integer,
  actual_qty integer,
  scrap_qty integer DEFAULT 0,
  variance integer GENERATED ALWAYS AS (actual_qty - planned_qty) STORED,
  status text DEFAULT 'completed',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.cut_batches ENABLE ROW LEVEL SECURITY;
-- RLS: company members can read/insert
CREATE POLICY "Company members can view cut_batches" ON public.cut_batches
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert cut_batches" ON public.cut_batches
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE INDEX idx_cut_batches_machine ON public.cut_batches(machine_id);
CREATE INDEX idx_cut_batches_plan_item ON public.cut_batches(cut_plan_item_id);
```

### Migration 2: Create `waste_bank_pieces` table
```sql
CREATE TABLE public.waste_bank_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  bar_code text NOT NULL,
  length_mm integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  source_job_id uuid,
  source_batch_id uuid REFERENCES public.cut_batches(id),
  source_machine_id uuid REFERENCES public.machines(id),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','consumed')),
  location text,
  reserved_by uuid,
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.waste_bank_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view waste_bank" ON public.waste_bank_pieces
  FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can insert waste_bank" ON public.waste_bank_pieces
  FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Company members can update waste_bank" ON public.waste_bank_pieces
  FOR UPDATE TO authenticated USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE INDEX idx_waste_bank_status ON public.waste_bank_pieces(status, bar_code);
```

### Migration 3: Add `active_plan_id` and `machine_lock` to machines
```sql
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS active_plan_id uuid;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS machine_lock boolean DEFAULT false;
```

### Edge Function: `manage-machine/index.ts` — Major Patch

**start-run action changes:**
1. Check job lock: if `machine.cut_session_status === 'running'` AND `machine.active_job_id` exists AND it's a different job → return 403 `cutter_switch_blocked`
2. Set lock columns on machine: `active_job_id` (the cut_plan_item_id from body), `active_plan_id`, `cut_session_status = 'running'`, `job_assigned_by` (from body or default 'manual'), `machine_lock = true`
3. Log `cutter_job_assigned` and `cutter_started` production events

**complete-run action changes:**
1. Create `cut_batch` record with planned_qty, actual_qty, scrap, machine, plan item
2. If variance != 0, log `variance_detected` production event
3. Generate waste bank pieces for remnants (if `remnantLengthMm` provided in body and >= 300mm)
4. Clear lock columns: `active_job_id = null`, `active_plan_id = null`, `cut_session_status = 'idle'`, `machine_lock = false`
5. Log `cutter_completed` and `cut_batch_created` production events

**pause-run action changes:**
1. Set `cut_session_status = 'paused'` (keep `active_job_id` — don't clear it)
2. Log `cutter_paused` production event

**New body params accepted:**
- `cutPlanItemId` — links to the active cut_plan_item
- `cutPlanId` — the plan being worked on
- `assignedBy` — 'manual' | 'optimizer' | 'supervisor'
- `plannedQty` — expected output for batch tracking
- `remnantLengthMm` — leftover length to create waste bank piece
- `remnantBarCode` — bar code for waste piece

### `src/lib/manageMachineService.ts` — Add new params
Add `cutPlanItemId`, `cutPlanId`, `assignedBy`, `plannedQty`, `remnantLengthMm`, `remnantBarCode` to `ManageMachineParams`.

### `src/types/machine.ts` — Extend Machine interface
Add `active_job_id`, `active_plan_id`, `cut_session_status`, `job_assigned_by`, `machine_lock` to `Machine` interface.

### `src/hooks/useLiveMonitorData.ts` — No changes needed
Already selects `*` from machines, so new columns are included automatically.

### `src/components/shopfloor/CutterStationView.tsx` — Hardening

**Refresh-safe state restoration:**
- On mount, if `machine.cut_session_status === 'running'` and `machine.active_job_id`:
  - Find the matching item in `items` array
  - Set `currentIndex` to that item
  - Set `isRunning = true`
  - Fetch the active `machine_run` to restore `activeRunId`
  - This prevents job-jump on refresh

**Lock enforcement:**
- Disable item navigation arrows while `machine.machine_lock === true`
- Show lock badge in header: "🔒 LOCKED — Manual Assignment" or "🔒 LOCKED — Active Run"

**start-run: send lock params:**
- Pass `cutPlanItemId: currentItem.id`, `cutPlanId: currentItem.cut_plan_id`, `assignedBy: 'manual'`

**complete-run: send batch params:**
- Pass `plannedQty: barsForThisRun * computedPiecesPerBar`, `cutPlanItemId: currentItem.id`, `cutPlanId: currentItem.cut_plan_id`
- For remnants, pass `remnantLengthMm` and `remnantBarCode`

**Lock status display:**
- Add a small status bar below the header showing:
  - Active job (mark number)
  - Machine lock status (locked/unlocked)
  - Assigned by (manual/optimizer/supervisor)

### New: `src/pages/WasteBankAdmin.tsx`
Simple admin page showing waste bank inventory:
- Table with columns: Bar Code, Length, Qty, Status, Source Job, Source Batch, Location, Created
- Filter tabs: Available | Reserved | Consumed | All
- Summary cards: Total Available, Total Reserved, Total Consumed
- Route: `/admin/waste-bank`

### `src/App.tsx` — Add route
```tsx
<Route path="/admin/waste-bank" element={<P><AdminRoute><WasteBankAdmin /></AdminRoute></P>} />
```

### New: `src/hooks/useWasteBank.ts`
Hook to query `waste_bank_pieces` with company_id filter and realtime subscription.

## Production Event Types Added
| Event | When |
|-------|------|
| `cutter_job_assigned` | start-run sets lock |
| `cutter_started` | run begins |
| `cutter_paused` | pause-run |
| `cutter_completed` | complete-run |
| `cutter_switch_blocked` | attempted job change while locked |
| `cut_batch_created` | batch record inserted |
| `waste_bank_reserved` | waste piece reserved (Phase 2 foundation) |
| `waste_bank_consumed` | waste piece consumed (Phase 2 foundation) |
| `variance_detected` | actual != planned in batch |

## Files Changed Summary
| File | Change |
|------|--------|
| Migration SQL (1) | Create `cut_batches` table |
| Migration SQL (2) | Create `waste_bank_pieces` table |
| Migration SQL (3) | Add `active_plan_id`, `machine_lock` to machines |
| `supabase/functions/manage-machine/index.ts` | Job lock enforcement, cut batch creation, waste bank generation, production events |
| `src/lib/manageMachineService.ts` | Add new params to interface |
| `src/types/machine.ts` | Add lock fields to Machine |
| `src/components/shopfloor/CutterStationView.tsx` | Refresh-safe restoration, lock enforcement, batch params on complete |
| `src/pages/WasteBankAdmin.tsx` | New admin page |
| `src/hooks/useWasteBank.ts` | New hook |
| `src/App.tsx` | Add waste-bank route |

## Risks / Phase 3 Follow-up
- Waste bank reserve/consume actions are schema-ready but not yet wired to the optimizer (Phase 3)
- Bend queue integration with cut_batches comes in Phase 3
- Bundle creation from bend completion comes in Phase 3

