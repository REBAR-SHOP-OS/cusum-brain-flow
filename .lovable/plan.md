

# Fix: Extraction Background Task Gets Killed

## Root Cause

The `extract-manifest` edge function tries to use `EdgeRuntime.waitUntil()` to run the AI task in the background, but **Supabase Edge Functions don't have `EdgeRuntime`**. The fallback code just lets the promise float:

```js
bgTask.catch((e) => console.error("Background task error:", e));
```

The function returns immediately, and the Deno worker **shuts down ~3 seconds later**, killing the AI call mid-flight. The logs confirm this: boot at 06:36:23, AI call starts at 06:36:24, worker shutdown at 06:39:42 — but no completion log, and the client shows 0 rows extracted.

## Fix (2 files, minimal diff)

### 1. `supabase/functions/extract-manifest/index.ts` — Make synchronous

Remove the background task pattern entirely. The function should **await** the full extraction before returning. Supabase Edge Functions support up to 150s wall time, which is sufficient for the AI call.

- Remove the `bgTask` wrapper and `EdgeRuntime.waitUntil` block
- Await all operations inline (they already update progress in the DB)
- Return `{ status: "extracted", sessionId }` on success or `{ status: "error" }` on failure
- Keep all progress updates (10→20→30→70→85→100) so the client can poll during execution

### 2. `src/lib/extractService.ts` — Fire-and-forget invoke

Change `runExtract` to **not await** the edge function response. The client doesn't need the response — it polls `extract_sessions` for status.

```ts
// Don't await — let it run, client polls for completion
supabase.functions.invoke("extract-manifest", { body: {...} });
```

### Flow After Fix

```text
Client calls runExtract() → returns immediately (no await)
Client starts pollForCompletion() → checks DB every 3s
Edge function runs synchronously (30-90s) → updates progress → saves rows → marks "extracted"
Poll detects "extracted" → UI proceeds to mapping
```

### Why This Works
- Edge function stays alive for the full duration (up to 150s) because it hasn't returned yet
- Client is non-blocking because it fires the invoke without awaiting
- Progress updates still work because the function writes to DB during execution
- No architectural change — just fixing the broken background pattern

