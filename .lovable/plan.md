

# Fix "Edge Function returned a non-2xx status code" on Report Download

## Root Cause
Two issues combine to produce the opaque error:

1. **Edge function returns HTTP 500 on errors** (line 201) — `supabase.functions.invoke()` swallows the response body on non-2xx status codes, so the client only sees "Edge Function returned a non-2xx status code" instead of the real error message.

2. **Client uses `supabase.functions.invoke()`** instead of the project's existing `invokeEdgeFunction` utility which uses raw `fetch` and properly reads error bodies on any status code.

Additionally, the edge function may be timing out on large reports (AI generation can take 30+ seconds).

## Fix

### 1. Edge Function: Always return 200 with error in body
**File:** `supabase/functions/generate-daily-report-pdf/index.ts`

Change the error catch block (line 200-205) to return `status: 200` with an `error` field in the JSON body — this ensures the client always receives the error message.

```typescript
// Before (line 201-202):
return new Response(JSON.stringify({ error: err.message }), {
  status: 500, ...

// After:
return new Response(JSON.stringify({ error: err.message }), {
  status: 200, ...
```

### 2. Client: Use `invokeEdgeFunction` with longer timeout
**File:** `src/components/vizzy/VizzyBrainPanel.tsx`

Replace `supabase.functions.invoke()` with the project's existing `invokeEdgeFunction` utility which handles error bodies correctly and supports configurable timeouts (AI report generation needs more than 30s).

```typescript
// Before:
const { data, error } = await supabase.functions.invoke("generate-daily-report-pdf", { body: ... });

// After:
const data = await invokeEdgeFunction("generate-daily-report-pdf", { ... }, { timeoutMs: 90000 });
```

| File | Change |
|------|--------|
| `supabase/functions/generate-daily-report-pdf/index.ts` | Return status 200 on errors (with error field in body) |
| `src/components/vizzy/VizzyBrainPanel.tsx` | Switch to `invokeEdgeFunction` with 90s timeout, import it |

