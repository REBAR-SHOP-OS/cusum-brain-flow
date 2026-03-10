

# Phase 1: Extract Hardening, Duplicate Detection, Production Events, Machine Lock Foundation

## Database Migrations

### Migration 1: Add `duplicate_key` and `merged_into_id` to `extract_rows`
```sql
ALTER TABLE public.extract_rows ADD COLUMN duplicate_key text;
ALTER TABLE public.extract_rows ADD COLUMN merged_into_id uuid REFERENCES public.extract_rows(id);
ALTER TABLE public.extract_rows ADD COLUMN original_quantity integer;
CREATE INDEX idx_extract_rows_duplicate_key ON public.extract_rows(session_id, duplicate_key);
```
- `duplicate_key`: computed as `{project}:{mark}:{size}:{length}:{shape}` 
- `merged_into_id`: points to the surviving row (for traceability)
- `original_quantity`: preserves pre-merge quantity

### Migration 2: Create `production_events` table
```sql
CREATE TABLE public.production_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  session_id uuid,
  job_id uuid,
  row_id uuid,
  machine_id uuid,
  batch_id uuid,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  triggered_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.production_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members can view production events" ON public.production_events
  FOR SELECT TO authenticated USING (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Company members can insert production events" ON public.production_events
  FOR INSERT TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  );
CREATE INDEX idx_production_events_session ON public.production_events(session_id);
CREATE INDEX idx_production_events_type ON public.production_events(event_type);
```

### Migration 3: Add machine lock columns to `machines`
```sql
ALTER TABLE public.machines ADD COLUMN active_job_id uuid;
ALTER TABLE public.machines ADD COLUMN cut_session_status text DEFAULT 'idle';
ALTER TABLE public.machines ADD COLUMN job_assigned_by text DEFAULT 'optimizer';
```

## Edge Function Changes

### `supabase/functions/manage-extract/index.ts`

**New action: `detect-duplicates`** (called after extraction, before mapping)
- Computes `duplicate_key` for each row in the session
- Identifies duplicates (same `duplicate_key`)
- Merges by: keeping 1 survivor row, summing quantities, setting `merged_into_id` on absorbed rows, marking absorbed rows `status = 'merged'`
- Logs `duplicate_merged` production events
- Returns merge summary

**Session name validation in `approve`:**
- Block session names < 3 chars or whitespace-only
- Block common junk names: "test", "asdf", "xxx", "123", etc.
- Log `session_name_blocked` event and return 400

**Approval idempotency guard:**
- Check if session is already approved before creating downstream records
- Re-run blocker check at approval time (not just relying on stale validation)

**Production event logging:**
- `extract_created` — logged in `extractService.ts` after session + rows created
- `validation_approved` — logged in `approve` action
- `approval_blocked` — logged when blockers prevent approval

### `src/lib/extractService.ts`
- Add `detectDuplicates(sessionId)` function that calls the new edge function action
- After `runExtract` succeeds, auto-call `detectDuplicates`

## Frontend Changes

### `src/components/office/AIExtractView.tsx`

**Session name validation:**
- Add inline error state when manifest name is too short or junk
- Disable Extract button when name fails validation
- Show red error text below the Scope field

**Duplicate detection UI:**
- Add a "Duplicates" summary card after extraction showing: X duplicates found, Y rows merged
- In the extract rows table, add a visual indicator column (icon) for rows that were merged (quantity was increased)
- Rows with `status === 'merged'` are hidden from the main table but counted in the summary
- Show `original_quantity → new_quantity` when a row was augmented

**Validation blockers UI:**
- Already exists (errors panel). Add: if blockers > 0, disable the Approve button with tooltip explaining why
- This is already partially done but needs the approval button to be truly gated

**Pipeline step addition:**
- Add "Dedupe" step between "Extracted" and "Mapped" in `PIPELINE_STEPS`

### `src/hooks/useExtractSessions.ts`
- Update `ExtractRow` type to include `duplicate_key`, `merged_into_id`, `original_quantity`

## Flow Summary

```text
Upload → Extract → Detect Duplicates → Map → Validate → Optimize → Approve
                        ↓
              merge dupes, log events
              show summary in UI
```

## Files Changed

| File | Change |
|------|--------|
| Migration SQL (1) | `duplicate_key`, `merged_into_id`, `original_quantity` on `extract_rows` |
| Migration SQL (2) | `production_events` table with RLS |
| Migration SQL (3) | `active_job_id`, `cut_session_status`, `job_assigned_by` on `machines` |
| `supabase/functions/manage-extract/index.ts` | Add `detect-duplicates` action, session name validation in approve, idempotency guard, production event logging |
| `src/lib/extractService.ts` | Add `detectDuplicates()`, log `extract_created` event, auto-call after extraction |
| `src/components/office/AIExtractView.tsx` | Session name validation UI, duplicate summary card, merged row indicators, dedupe pipeline step |
| `src/hooks/useExtractSessions.ts` | Extend `ExtractRow` type with new columns |

## Risks / Phase 2 Follow-up
- Machine lock columns are schema-only in Phase 1; enforcement logic comes in Phase 2
- `production_events` table is created and written to; no admin viewer yet (Phase 4)
- Existing approved sessions are unaffected (new columns are nullable/defaulted)

