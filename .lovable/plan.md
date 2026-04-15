

## Plan: Improve SEMrush NO_UNITS Error Handling

### Problem
When SEMrush API units are exhausted, the edge function throws `SEMRUSH_NO_UNITS` which results in a non-2xx response. The client-side hook (`useSemrushApi.ts`) has a check for `"units exhausted"` in the error message, but the edge function returns a generic 500 error instead of a structured JSON response with the `NO_UNITS` code.

### Root cause
In `semrush-api/index.ts`, when `SEMRUSH_NO_UNITS` is thrown, it bubbles up as an unhandled error causing a 500 response with no JSON body. The client never sees the `NO_UNITS` code or the "units exhausted" substring — it only gets the generic Supabase error wrapper.

### Fix

**File: `supabase/functions/semrush-api/index.ts`**

In the error handler (where `SEMRUSH_NO_UNITS` is caught), return a **402 JSON response** instead of letting it become a 500:

```typescript
if (e.message === "SEMRUSH_NO_UNITS") {
  return new Response(JSON.stringify({ 
    code: "NO_UNITS", 
    error: "SEMrush API units exhausted. Top up at semrush.com or wait for monthly reset." 
  }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

This ensures the client-side `handleResponse` in `useSemrushApi.ts` correctly detects `data.code === "NO_UNITS"` and shows the proper toast message.

### Result
Instead of "Edge Function returned a non-2xx status code", users will see: "SEMrush API units exhausted. Top up at semrush.com or wait for monthly reset."
