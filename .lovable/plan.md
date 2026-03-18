

## Diagnosis: Extraction Stuck at 85% — Row Insert Timeout

### What happened
The edge function for session "GRADE BEAM - KCA" successfully:
1. Fetched the file
2. Called the AI model (Gemini 2.5 Pro)
3. Parsed the AI response
4. Updated progress to 85%

Then it **timed out** during the bulk row insertion (`extract_rows.insert(rows)`) at line 388. The function hit the edge function execution time limit before it could either complete the insert or mark the session as "extracted". No error was written because the timeout killed the function before the catch block ran.

### Root Cause
Large manifests can produce hundreds of rows. Inserting them all in a single bulk `insert()` can exceed the edge function's time limit (150s), especially if the AI call already consumed most of that budget.

### Fix Plan

**File: `supabase/functions/extract-manifest/index.ts`** (~lines 350-390)

1. **Batch the row insertion** — Instead of inserting all rows in one call, chunk them into batches of 50 rows and insert sequentially. This prevents a single massive insert from timing out.

2. **Add a recovery mechanism** — Before the insert loop, update progress incrementally (85→90→95) as batches complete, giving visibility into insert progress.

3. **Immediate fix for the stuck session** — Reset the stuck session status to "error" so the user can retry, via a one-time DB update.

**File: `src/components/office/AIExtractView.tsx`** (~line 408)

4. **Replace fire-and-forget with awaited call** — The current `runExtract` in `extractService.ts` fires the edge function as fire-and-forget (`.then()/.catch()`). Change to properly await it so errors propagate to the UI immediately rather than being silently swallowed.

**File: `src/lib/extractService.ts`** (~lines 184-215)

5. **Make `runExtract` await the response** — Convert the fire-and-forget pattern to a proper `await` so the caller can catch invocation failures.

### Code Changes

**extract-manifest/index.ts** — Replace single insert with batched:
```typescript
// Batch insert rows (50 at a time) to avoid timeout
const BATCH_SIZE = 50;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error: insertErr } = await svcClient.from("extract_rows").insert(batch);
  if (insertErr) throw new Error(`Failed to save rows batch ${i}: ${insertErr.message}`);
  const pct = 85 + Math.round((i / rows.length) * 14);
  await svcClient.from("extract_sessions").update({ progress: pct }).eq("id", sessionId);
}
```

**extractService.ts** — Make `runExtract` properly throw on failure:
```typescript
const res = await supabase.functions.invoke("extract-manifest", { body: { ... } });
if (res.error) throw new Error(res.error.message || "Extract invocation failed");
if (res.data?.status === "error") throw new Error(res.data.error || "Extraction failed");
```

**Database** — Reset the stuck session so the user can retry immediately:
```sql
UPDATE extract_sessions 
SET status = 'error', error_message = 'Extraction timed out during row save. Please retry.'
WHERE id = 'b3b8dcf9-438a-43a8-8d6f-2da03ee797f2' AND status = 'extracting';
```

### Summary
- 3 files modified, 1 DB fix
- Batched inserts prevent future timeouts
- Proper error propagation replaces silent fire-and-forget
- Stuck session gets reset for immediate retry

