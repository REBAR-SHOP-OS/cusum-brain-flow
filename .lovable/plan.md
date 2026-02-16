
# Harden ERP Autopilot for Production Safety

## Overview

This upgrade adds four critical safety layers to the autopilot execution engine: explicit write flags, preflight rollback capture, table-driven risk policies, and idempotent/resumable execution with run-level locking.

## 1. Database Changes (Migration)

### New Tables

**`autopilot_risk_policies`** -- Table-driven risk rules per tool/model/field combination:
- `id` (uuid, PK)
- `tool_name` (text, not null)
- `model` (text) -- nullable, for tool-wide rules
- `field` (text) -- nullable, for model-wide rules
- `risk_level` (text, not null) -- low/medium/high/critical
- `notes` (text)
- `company_id` (uuid, FK to companies)
- `created_at`, `updated_at`

**`autopilot_protected_models`** -- Registry of protected Odoo models:
- `id` (uuid, PK)
- `model` (text, not null, unique)
- `risk_level` (text, not null, default 'critical')
- `notes` (text)
- `created_at`

### Seed Data for `autopilot_protected_models`

Pre-populate with: `account.move`, `account.payment`, `account.bank.statement`, `hr.payslip`, `hr.employee`, `res.users`, `res.partner`, `stock.quant`, `product.template`, `ir.config_parameter`, `ir.rule`, `ir.model.access`

### Seed Data for `autopilot_risk_policies`

- `odoo_write` + `account.move` -> critical
- `odoo_write` + `hr.*` models -> high
- `odoo_write` + `ir.*` models -> critical
- `odoo_write` + any + field `state` -> high
- `odoo_write` + any + field `stage_id` -> high
- `generate_patch` + any -> high
- `validate_code` + any -> low

### Schema Changes to Existing Tables

**`autopilot_runs`** -- Add lock columns:
- `execution_lock_uuid` (uuid, nullable)
- `execution_started_at` (timestamptz, nullable)

### RLS Policies

- `autopilot_risk_policies`: Admin read/write, scoped to company
- `autopilot_protected_models`: Admin read-only (service_role manages inserts)

### Validation Triggers

- `autopilot_risk_policies`: validate `risk_level` in (low, medium, high, critical)
- `autopilot_protected_models`: validate `risk_level` in (low, medium, high, critical)

## 2. Backend Changes (`autopilot-engine/index.ts`)

### A) Explicit Write Flag

In `executeTool()`, before any `odoo_write` execution:
- Check `toolParams.allow_write === true`
- If missing/false, return `{ success: false, error: "allow_write flag required" }`

### B) Preflight Rollback Capture

Before executing `odoo_write` with action `"write"`:
1. Authenticate to Odoo
2. Call `read` on the target record for the fields being changed
3. Store the current values into `autopilot_actions.rollback_metadata` as `{ model, record_id, original_values }`
4. Only then proceed with the write

### C) Table-Driven Risk Policy

Replace the hardcoded `PROTECTED_ODOO_MODELS` array and `computeRisk()` logic:

1. New async function `computeRiskFromDb(svcClient, toolName, toolParams)`:
   - Query `autopilot_protected_models` to check if the model is protected
   - Query `autopilot_risk_policies` for matching tool/model/field rules
   - Pick the highest risk level found
   - Fall back to current hardcoded defaults if no DB policies match
2. Update all call sites from `computeRisk()` to `computeRiskFromDb()`

### D) Idempotent and Resumable Execution

In `execute_run` handler:

1. **Run-level lock**: Before execution, attempt to set `execution_lock_uuid` and `execution_started_at` on the run. If already locked and started less than 5 minutes ago, return error "Run is locked by another execution".
2. **Skip completed actions**: In the action loop, skip actions with `status === "completed"`.
3. **Timeout stale executing actions**: If `action.status === "executing"` and `executed_at` is null and the action has been in that state for more than 5 minutes, mark it as `failed` with error "Execution timeout".
4. **Release lock** on completion (set `execution_lock_uuid = null`).
5. Allow re-execution of a `failed` run (not just `approved`) to support resumability.

## 3. Frontend Changes (`AutopilotDashboard.tsx`)

### Allow-write Error Display

Already handled -- action errors display via `action.error_message`. The new "allow_write flag required" error will surface automatically.

### Execution Lock Indicator

- Update `AutopilotRun` interface to include `execution_lock_uuid` and `execution_started_at`
- When a run has `execution_lock_uuid` set and `status === "executing"`:
  - Show a lock icon with tooltip "Execution in progress by another session"
  - Disable the "Execute Run" button
- When `status === "failed"`, show a "Resume Run" button (calls `execute_run` which will skip completed actions)

## Files to Modify

| File | Change |
|---|---|
| New migration SQL | Create 2 tables, add 2 columns, seed data, RLS, triggers |
| `supabase/functions/autopilot-engine/index.ts` | All 4 hardening features (A-D) |
| `src/pages/AutopilotDashboard.tsx` | Lock indicator, resume button |

## What This Does NOT Touch

- No changes to `ai-agent/index.ts` (proxy tools remain as-is)
- No removal of existing features
- Audit trail preserved and enhanced
