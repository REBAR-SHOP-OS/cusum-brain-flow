
# Two Final Hardening Improvements

## 1. Fix `computeRiskFromDb` — Proper `matchedPolicy` Tracking

**Problem**: The current code uses `warnings.length === 0` to decide whether to fall back to hardcoded logic. This is fragile because a policy might match but produce no warning text (e.g., `notes` is null).

**Fix** (lines 24-69 of `autopilot-engine/index.ts`):
- Add a `let matchedPolicy = false` boolean
- Set `matchedPolicy = true` when a protected model row is found
- Set `matchedPolicy = true` when any risk policy row matches (modelMatch + fieldMatch)
- Change the fallback condition from `if (warnings.length === 0)` to `if (!matchedPolicy)`

## 2. Atomic Lock Acquisition via Conditional Update

**Problem**: The current lock logic does a read-then-write (lines 478-494), which has a race window — two concurrent requests could both read the lock as null and both acquire it.

**Fix** (lines 477-494 of `autopilot-engine/index.ts`):
- Replace the separate read + write with a single conditional update:

```text
UPDATE autopilot_runs
SET execution_lock_uuid = <uuid>,
    execution_started_at = now(),
    status = 'executing',
    phase = 'execution',
    started_at = COALESCE(started_at, now())
WHERE id = run_id
  AND company_id = companyId
  AND (execution_lock_uuid IS NULL
       OR execution_started_at < now() - interval '5 minutes')
```

- Use an RPC function (`acquire_autopilot_lock`) to perform this atomically and return affected row count
- If `affectedRows === 0`, return HTTP 423 with "Run is locked by another execution"
- Remove the old manual lock check + separate update
- This requires a new DB function via migration

## 3. Lock Race Safety Test

Add a fourth test case to the existing `index.test.ts`:
- Call `execute_run` twice rapidly with the same `run_id` (needs a valid auth token, so this will be a lightweight log-based verification)
- Since we cannot easily create authenticated test runs, add `console.log` breadcrumbs in the lock acquisition path:
  - Log `"LOCK_ACQUIRED"` with the lock UUID on success
  - Log `"LOCK_REJECTED"` on 423 response
- These can be verified via edge function logs

## Files to Change

| File | Change |
|---|---|
| New migration SQL | Create `acquire_autopilot_lock` RPC function |
| `supabase/functions/autopilot-engine/index.ts` | Fix `computeRiskFromDb` matchedPolicy tracking; replace lock logic with RPC call; add lock logging |

## Technical Details

### DB Function: `acquire_autopilot_lock`

```text
CREATE OR REPLACE FUNCTION public.acquire_autopilot_lock(
  _run_id uuid,
  _company_id uuid,
  _lock_uuid uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _affected integer;
BEGIN
  UPDATE autopilot_runs
  SET execution_lock_uuid = _lock_uuid,
      execution_started_at = now(),
      status = 'executing',
      phase = 'execution',
      started_at = COALESCE(started_at, now())
  WHERE id = _run_id
    AND company_id = _company_id
    AND status IN ('approved', 'failed')
    AND (execution_lock_uuid IS NULL
         OR execution_started_at < now() - interval '5 minutes');
  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$$;
```

### computeRiskFromDb changes (simplified diff)

```text
  let matchedPolicy = false;
  // ... after protectedRow found:
  matchedPolicy = true;
  // ... after policy match in loop:
  matchedPolicy = true;
  // ... fallback condition:
  if (!matchedPolicy) {
    return computeRiskFallback(toolName, toolParams);
  }
```

### execute_run lock replacement

```text
  const lockUuid = crypto.randomUUID();
  const { data: lockResult } = await svcClient.rpc("acquire_autopilot_lock", {
    _run_id: run_id,
    _company_id: companyId,
    _lock_uuid: lockUuid,
  });
  if (!lockResult || lockResult === 0) {
    console.log("LOCK_REJECTED", { run_id, attempted_lock: lockUuid });
    return json({ error: "Run is locked by another execution" }, 423);
  }
  console.log("LOCK_ACQUIRED", { run_id, lock_uuid: lockUuid });
```

This also removes the old manual lock check (lines 478-494) and the separate update (lines 488-494), replacing them with the single atomic RPC call.
