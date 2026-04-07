

# Shop Floor Pipeline Audit — Findings and Fix Plan

## Current State

### Machines
| Machine | Status | Issue |
|---------|--------|-------|
| CUTTER-01 | Running | Active, working normally (run started 40min ago) |
| CUTTER-02 | **Running (8.5h)** | **STALE** — locked to job AS37 which is already `phase: complete` (26/26 pieces). Run started 8h ago, never completed. |
| BENDER-01/02/03 | Idle | Clean |
| SPIRAL-01 | Idle | Clean |

### Phase Distribution (cut_plan_items)
| Phase | Count | Notes |
|-------|-------|-------|
| clearance | 222 | Waiting for QC |
| complete | **102** | **Legacy — should be `clearance`**. 90 straight + 12 bend (all fully bent). These were set to `complete` before the trigger fix that routes straight items to `clearance`. |
| queued | 70 | Waiting for cutting |
| cut_done | 11 | Waiting for bending |

### Production Events (24h)
- **18 stale run auto-recoveries** — all `active_job_done` type. This is the auto-recovery working correctly, but the high count suggests the complete-run flow sometimes doesn't fire properly (likely operator closing the browser mid-run or network drops).
- **18 canceled runs** (all auto-canceled from recovery) vs **12 completed runs** — 60% recovery rate is concerning.

## Issues Found

### Issue 1: CUTTER-02 Stale Run (CRITICAL)
CUTTER-02 has been "running" for 8.5 hours with job AS37 already complete. The auto-recovery only triggers on `start-run`, so if nobody starts a new run, the machine stays locked indefinitely.

**Fix**: Run a data migration to cancel the stale run and reset CUTTER-02 to idle.

### Issue 2: 102 Items Stuck in `complete` Phase (DATA)
The trigger was updated (migration `20260407`) to route straight items to `clearance` instead of `complete`, but 102 items that completed before this migration are stuck in `complete`. They never went through QC clearance.

- 90 straight items: should be `clearance`
- 12 bend items (bend_completed = total): should also be `clearance`

**Fix**: Run a data migration to move all 102 `complete` items to `clearance`.

### Issue 3: No Proactive Stale Run Cleanup
The system relies on the next `start-run` to detect and recover stale runs. If the shift ends and nobody starts a new run, machines stay locked. There's no cron or periodic check.

**Fix (future)**: This is a known architectural gap. No code change proposed now — just flagged.

## Migration Plan

### Single SQL Migration

```sql
-- 1. Cancel CUTTER-02 stale run
UPDATE machine_runs 
SET status = 'canceled', ended_at = now(), 
    notes = 'Auto-canceled: stale run audit cleanup (8h+ with completed job)'
WHERE id = 'b3e1a18d-533c-4284-a18d-e855b7bd2918' 
  AND status = 'running';

-- 2. Reset CUTTER-02 machine state
UPDATE machines 
SET current_run_id = NULL, active_job_id = NULL, active_plan_id = NULL,
    cut_session_status = 'idle', machine_lock = false, 
    job_assigned_by = NULL, status = 'idle', last_event_at = now()
WHERE id = 'b0000000-0000-0000-0000-000000000002';

-- 3. Move 102 stuck 'complete' items to 'clearance'
UPDATE cut_plan_items 
SET phase = 'clearance' 
WHERE phase = 'complete' 
  AND completed_pieces >= total_pieces 
  AND total_pieces > 0;
```

### No Code Changes
- The trigger (`auto_advance_item_phase`) is already correct since the latest migration
- The auto-recovery logic in `manage-machine` works correctly for `active_job_done` scenarios
- The clearance UI already picks up items with `phase = 'clearance'`

## Impact
- CUTTER-02 immediately available for new jobs
- 102 items appear in Clearance screen for QC review
- No disruption to CUTTER-01 (currently running)
- No code changes needed

