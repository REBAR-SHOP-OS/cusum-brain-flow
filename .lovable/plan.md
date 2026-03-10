

# Fix: Supervisor Button + Generic Edge Function Errors

## Problems Identified

1. **Supervisor button not working for `ai@rebar.shop`**: The toggle requires `isAdmin || isShopSupervisor` role check (line 46 of CutterStationView.tsx). User only has `workshop` role — needs `admin` and `shop_supervisor` added.

2. **Generic "non-2xx status code" error for ALL users**: The `supabase.functions.invoke()` SDK sets `data` to `null` for non-2xx responses (known SDK bug). Our error handler reads `(data as any)?.error` which is always `null`, so it falls through to the generic `error.message`. This affects 5 service files.

## Solution

### 1. Database: Grant full access to `ai@rebar.shop`

Add `admin` and `shop_supervisor` roles:
```sql
INSERT INTO user_roles (user_id, role) VALUES 
  ('<user_id>', 'admin'),
  ('<user_id>', 'shop_supervisor');
```

### 2. Create `src/lib/invokeEdgeFunction.ts` — bypass the SDK

A small utility that uses raw `fetch()` instead of `supabase.functions.invoke()`:
- Gets session token from `supabase.auth.getSession()`
- Calls `fetch()` directly to `VITE_SUPABASE_URL/functions/v1/<name>`
- Parses JSON body regardless of status code
- Throws with the **real** server error message

### 3. Update all 5 service files to use the new helper

| File | Current | Fix |
|------|---------|-----|
| `src/lib/manageMachineService.ts` | `supabase.functions.invoke` | `invokeEdgeFunction` |
| `src/lib/machineRunService.ts` | same | same |
| `src/lib/manageBendService.ts` | same | same |
| `src/lib/inventoryService.ts` | same | same |
| `src/lib/dispatchService.ts` | same | same |

Each change is ~3 lines: replace the invoke call with `invokeEdgeFunction("function-name", params)` and remove the separate error-checking blocks.

### 4. Database cleanup

Reset any stuck machine state on CUTTER-01 if present.

