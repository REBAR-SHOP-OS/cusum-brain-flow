

# Root Cause: `error.context.json()` Always Fails — Body Already Consumed

## The Real Problem

In `@supabase/supabase-js` v2, when an edge function returns a non-2xx status, the SDK does this internally:
1. Reads the response body → puts the parsed result in `data`
2. Creates a `FunctionsHttpError` → sets `error.context` to the raw `Response` object

**But the Response body is a one-time-read stream.** Since the SDK already consumed it to populate `data`, calling `error.context.json()` in our code **always throws** silently. The catch block swallows it, and we fall through to the generic `error.message` = `"Edge Function returned a non-2xx status code"`.

The irony: the actual error message (`"Machine already has an active run"`, `"Forbidden: insufficient role"`, etc.) is already sitting in `data.error` — but we never reach line 79 (`if (data?.error)`) because we throw on line 77 first.

## Fix

**Check `data?.error` BEFORE throwing from the `error` block.** When both `data` and `error` are set, the real message is in `data`:

```typescript
const { data, error } = await supabase.functions.invoke("manage-machine", { body: params });

if (error) {
  // In supabase-js v2, non-2xx responses set BOTH data and error.
  // The real server message is in data (body already consumed from error.context).
  const serverMessage = data?.error ?? null;
  throw new Error(serverMessage || error.message || "Failed to manage machine");
}
if (data?.error) throw new Error(data.error);
```

This is a 3-line change per file — no complex parsing, no `instanceof` checks, no `.context.json()` that silently fails.

## Database: Reset Stuck Machine (Again)

Machine CUTTER-01 is stuck running again from a run started 2 minutes ago. Need to cancel the orphan run and reset to idle.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/manageMachineService.ts` | Replace `FunctionsHttpError` parsing with simple `data?.error` check |
| `src/lib/machineRunService.ts` | Same fix |
| Database | Cancel orphan run, reset CUTTER-01 to idle |

