

# Fix: "Edge Function returned a non-2xx status code" on Cutter Station

## Root Cause

**Two problems working together:**

1. **Error messages are swallowed.** When the `manage-machine` edge function returns a meaningful error (e.g., "Machine already has an active run" or "Routing blocked"), the `manageMachineService.ts` only reads the generic SDK wrapper message: `"Edge Function returned a non-2xx status code"`. The actual server error body with the real reason is never parsed. This makes every failure look identical and impossible to diagnose.

2. **Machine is currently stuck.** The machine `CUTTER-01` has been locked in "running" state for over 1.5 hours from a previous abandoned run. The stale-run auto-recovery (30-minute threshold) should have cleaned it up, but since the user keeps seeing the generic error, they can't tell what's happening or take action.

## Fix

### 1. Parse real error body in `manageMachineService.ts`

Use the same pattern already proven in `useWebPhone.ts` — extract the JSON body from the `FunctionsHttpError` context:

```typescript
const { data, error } = await supabase.functions.invoke("manage-machine", { body: params });

if (error) {
  // Try to extract the real server error message
  let serverMessage: string | null = null;
  try {
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      serverMessage = body?.error ?? null;
    }
  } catch {}
  throw new Error(serverMessage || error.message || "Failed to manage machine");
}
```

This way, when the function returns 400 "Machine already has an active run" or 403 "Routing blocked", operators will see the **actual reason** in the toast — not a generic "non-2xx" message.

### 2. Apply same fix to `machineRunService.ts`

Same pattern — both service files call edge functions and have the same swallowed-error problem.

### 3. Reset stuck machine (one-time data fix)

Run a SQL update to clear the stuck run on CUTTER-01 so the operator can resume work immediately.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/manageMachineService.ts` | Parse `FunctionsHttpError` response body for real error messages |
| `src/lib/machineRunService.ts` | Same error-parsing fix |
| Database | One-time reset of stuck machine state |

