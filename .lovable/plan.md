
## Root Cause Audit

I audited the current code, backend state, and available function logs.

### What I found
1. The previously reported `base64` import bug is already fixed in the codebase:
   - `supabase/functions/extract-manifest/index.ts` now uses:
   ```ts
   import { encodeBase64 as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
   ```
2. The failing extract session in the database shows:
   - `status = error`
   - `error_message = "Failed to send a request to the Edge Function"`
3. There are **no runtime logs at all** for `extract-manifest`, and no recent function-edge analytics rows for it.
4. The frontend still calls `extract-manifest` via:
   ```ts
   supabase.functions.invoke("extract-manifest", ...)
   ```
   in `src/lib/extractService.ts`, which is known in this project to hide useful error bodies and collapse failures into generic transport errors.

### Root problem
The current failure is **not the old syntax bug in the repo code**. The deeper issue is that the app is attempting to call `extract-manifest`, but the deployed backend function is not successfully reachable/executing at all. Since there are no logs for the call, this points to an **operational/deployment mismatch** rather than extraction logic itself.

In short:

```text
UI -> runExtract() -> supabase.functions.invoke("extract-manifest")
   -> request fails before usable server response
   -> frontend stores generic "Failed to send a request to the Edge Function"
   -> user sees Retry failed / Extraction Failed
```

## Implementation Plan

### 1) Restore the backend function availability
**File:** `supabase/functions/extract-manifest/index.ts`

- Reconfirm the function source is deploy-safe and consistent with project standards
- Add a clear startup/request log near the top of the handler so future failures are visible immediately in backend logs
- Treat this as a redeploy/stale-runtime recovery for `extract-manifest`

Why:
- The repo code looks fixed, but the deployed function appears absent, stale, or not serving requests

### 2) Replace the extract call with the project-standard invocation utility
**File:** `src/lib/extractService.ts`

- Change `runExtract()` from `supabase.functions.invoke("extract-manifest", ...)`
- Use `invokeEdgeFunction("extract-manifest", ...)` instead
- Give extraction a longer timeout because this is a heavy AI/file-processing route

Why:
- This project’s standard utility preserves real server error messages
- It avoids the generic “Failed to send a request…” failure mode when the backend returns a structured error or stalls

### 3) Preserve better error state in the extraction UI
**Files:**  
- `src/lib/extractService.ts`
- `src/components/office/AIExtractView.tsx`

- Ensure network/backend invocation errors are normalized into clearer messages
- Keep writing session status back to `error`, but with the actual backend or timeout reason when available

Why:
- The current UX hides the real cause and makes retries look random

### 4) Verify retry flow uses the same hardened path
**File:** `src/components/office/AIExtractView.tsx`

- Keep the existing retry buttons
- Ensure retries go through the improved `runExtract()` behavior automatically
- Confirm the session leaves `extracting` and lands in a deterministic `error` or `extracted` state

## Files involved

| File | Change |
|---|---|
| `supabase/functions/extract-manifest/index.ts` | Add observability logs and treat as redeploy recovery target |
| `src/lib/extractService.ts` | Switch `runExtract()` to `invokeEdgeFunction` with better timeout/error handling |
| `src/components/office/AIExtractView.tsx` | Continue surfacing the improved error message through existing retry/error UI |
| `src/lib/invokeEdgeFunction.ts` | Reuse existing utility; likely no change needed unless timeout tuning is required |

## Expected result

After implementation:

```text
If backend is healthy:
- extraction starts
- session progresses normally
- rows are extracted

If backend fails:
- user sees the real reason (auth, timeout, validation, server error)
- session status is updated correctly
- logs clearly show whether extract-manifest was actually invoked
```

## Technical note
The most important insight from this audit is:

- The codebase already contains the earlier import fix
- The current outage is now centered on **function reachability / deployment state**
- The frontend’s use of `supabase.functions.invoke()` is masking the real backend failure and is the main reason the issue keeps looking opaque
