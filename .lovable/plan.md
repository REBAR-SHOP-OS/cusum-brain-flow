

# Fix: "Edge Function returned a non-2xx status code" for ai@rebar.shop

## Root Cause (confirmed via database query)

User `ai@rebar.shop` (ID: `6a0831f0-7d44-45a1-8e67-120ac8d9a0ca`) has **zero entries in `user_roles`**. The `manage-machine` edge function requires `admin` or `workshop` role (line 640) and returns HTTP 403 with `"Forbidden: insufficient role"`.

The error-parsing code we added to `manageMachineService.ts` is correct in structure but may fail silently because:
- The `error.context` on `FunctionsHttpError` is a `Response` object — calling `.json()` on it can only be done **once** (Response body is a stream consumed on first read)
- If the SDK internally reads the response body first, `ctx.json()` throws silently and falls through to the generic `error.message`

## Fix Plan

### 1. Assign `workshop` role to `ai@rebar.shop` (database)
```sql
INSERT INTO user_roles (user_id, role) VALUES ('6a0831f0-7d44-45a1-8e67-120ac8d9a0ca', 'workshop');
```

### 2. Clean up test run from debug curl (database)
The curl test created an orphan run. Reset machine to idle:
```sql
UPDATE machine_runs SET status = 'canceled', ended_at = NOW(), notes = 'Debug cleanup'
WHERE id = '997271fd-3ef1-403d-b181-fb120e178963';
UPDATE machines SET current_run_id = NULL, status = 'idle', machine_lock = false,
  active_job_id = NULL, cut_session_status = 'idle'
WHERE id = 'e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3';
```

### 3. Harden error parsing in `manageMachineService.ts`
Use the official `FunctionsHttpError` import and proper response body reading:
```typescript
import { FunctionsHttpError } from "@supabase/supabase-js";

if (error) {
  let serverMessage: string | null = null;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      serverMessage = body?.error ?? null;
    } catch {}
  }
  throw new Error(serverMessage || error.message || "Failed to manage machine");
}
```

### 4. Apply same fix to `machineRunService.ts`

### 5. Fix `log-machine-run` to use `getUser()` instead of deprecated `getClaims()`
Per project standards, replace `getClaims(token)` with `getUser()` to prevent intermittent auth failures.

## Files Changed

| File | Change |
|------|--------|
| Database | Add `workshop` role for `ai@rebar.shop`, clean up debug run |
| `src/lib/manageMachineService.ts` | Use `FunctionsHttpError` import for reliable error parsing |
| `src/lib/machineRunService.ts` | Same error-parsing hardening |
| `supabase/functions/log-machine-run/index.ts` | Replace `getClaims()` with `getUser()` |

