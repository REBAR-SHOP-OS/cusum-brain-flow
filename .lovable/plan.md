

# Phase 1: Central Brain Event Ledger -- DB + Core Engine

## Overview

Replace the existing `events` table with a new `activity_events` append-only ledger, add a `human_tasks` table with idempotent dedupe, and rewire `generate-suggestions` to consume from the new ledger. All existing code references to `events` will be updated to write to `activity_events`.

---

## 1. Database Migration

### 1a. Rename `events` to `activity_events` and add new columns

Rename the existing table (preserving 364 rows of data) and add new columns for the ledger spec:

| New Column | Type | Purpose |
|---|---|---|
| `source` | text NOT NULL DEFAULT 'system' | Origin: gmail, ringcentral, quickbooks, system, user |
| `dedupe_key` | text | Stable key for idempotent INSERT ... ON CONFLICT |
| `inputs_snapshot` | jsonb | Frozen copy of data that triggered this event |
| `processed_at` | timestamptz | When rule engine last evaluated this event |

Add a **partial unique index** on `dedupe_key` (WHERE `dedupe_key IS NOT NULL`) for idempotent inserts.

Keep existing columns: `id`, `event_type`, `entity_type`, `entity_id`, `actor_type`, `actor_id`, `description`, `metadata`, `created_at`, `company_id`.

Change `entity_id` from `uuid` to `text` (more flexible for external IDs like Gmail message IDs or RC call IDs). Requires creating a new column, migrating data, and swapping.

### 1b. Create `human_tasks` table

```
human_tasks (
  id             UUID PK DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL,
  agent_id       UUID REFERENCES agents(id),
  source_event_id UUID REFERENCES activity_events(id),
  dedupe_key     TEXT UNIQUE,
  title          TEXT NOT NULL,
  description    TEXT,
  severity       TEXT NOT NULL DEFAULT 'info',
  category       TEXT,
  entity_type    TEXT,
  entity_id      TEXT,
  inputs_snapshot JSONB,
  assigned_to    UUID,
  status         TEXT NOT NULL DEFAULT 'open',
  resolved_at    TIMESTAMPTZ,
  snoozed_until  TIMESTAMPTZ,
  actions        JSONB,
  reason         TEXT,
  impact         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

Partial unique index on `dedupe_key` WHERE `dedupe_key IS NOT NULL`.

### 1c. RLS Policies

**activity_events** -- same pattern as current `events`:
- SELECT/INSERT/UPDATE: company-scoped, any staff role
- DELETE: company-scoped, admin only
- No changes to the policy logic, just renamed table

**human_tasks**:
- SELECT: `company_id = get_user_company_id(auth.uid())`
- UPDATE: same company scope
- INSERT: admin + office roles

### 1d. Register missing agents

Insert into `agents` table: relay, gauge, atlas, blitz, pixel (currently only vizzy, penny, forge exist).

---

## 2. Update All `events` References to `activity_events`

15 files currently reference `.from("events")`. Each insert will be updated to:
- Use `.from("activity_events")`
- Add `source` field (e.g., `'system'`, `'gmail'`, `'ringcentral'`)
- Add `dedupe_key` where applicable (e.g., `machine_run:{id}:status_change`)

Files to update:
- `supabase/functions/log-machine-run/index.ts`
- `supabase/functions/manage-machine/index.ts`
- `supabase/functions/manage-extract/index.ts`
- `supabase/functions/comms-alerts/index.ts`
- `supabase/functions/vizzy-erp-action/index.ts`
- `supabase/functions/relay-pipeline/index.ts`
- `src/hooks/useVizzyContext.ts`
- `src/lib/foremanLearningService.ts`
- `src/lib/barlistService.ts`
- `supabase/functions/diagnostic-logs/index.ts`

---

## 3. Rewire `generate-suggestions` to Write `human_tasks`

The current `generate-suggestions` edge function writes to `suggestions`. It will be updated to:

1. **Query `activity_events`** for recent unprocessed events (WHERE `processed_at IS NULL`)
2. Apply the same deterministic rules (overdue AR, idle machines, bender starving, etc.)
3. Write results to `human_tasks` with `dedupe_key` using `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING`
4. Mark processed events with `processed_at = now()`
5. Continue writing to `suggestions` table as well for backward compatibility during transition

---

## 4. Frontend Hook: `useHumanTasks`

Create a new hook mirroring `useAgentSuggestions` but reading from `human_tasks`:
- Fetch open/new tasks filtered by agent code
- Act / Snooze / Dismiss mutations
- Log actions to `agent_action_log`

The existing `useAgentSuggestions` hook remains unchanged during transition.

---

## 5. Backward Compatibility

- A database **view** named `events` will be created pointing to `activity_events` so any missed references continue to work
- The `suggestions` table stays untouched; `human_tasks` runs in parallel
- Agent UI components can be incrementally switched from suggestions to human_tasks

---

## Files to Create
- `src/hooks/useHumanTasks.ts` -- new hook for human_tasks

## Files to Modify
- 10 files with `.from("events")` references (listed above)
- `supabase/functions/generate-suggestions/index.ts` -- dual-write to human_tasks
- 1 database migration (rename table, add columns, create human_tasks, register agents, RLS, view)

## No Changes
- `suggestions` table and `useAgentSuggestions` hook remain as-is
- Agent chat UI unchanged
- No new webhook receivers in this phase

