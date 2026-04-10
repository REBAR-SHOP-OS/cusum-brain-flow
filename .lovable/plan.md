

# Fix: "Edit failed — Unexpected end of JSON input" in Image Edit

## Problem
When using "Edit Image" on the Social Media page, clicking Apply fails with "Unexpected end of JSON input".

## Root Cause
In `supabase/functions/generate-image/index.ts` **line 259**, the edit mode path calls `const data = await resp.json();` **without a try/catch**. If the AI gateway returns a large base64 image response that gets truncated, or returns an empty/malformed body, `resp.json()` throws `"Unexpected end of JSON input"`. This unhandled exception causes the edge function to return a non-JSON error response (Deno's default 500), which in turn causes the client-side `invokeEdgeFunction` to also fail parsing.

Compare with the generate mode (line 351) — same vulnerability but less likely to hit because generate responses tend to be smaller.

## Fix — `supabase/functions/generate-image/index.ts`

### 1. Wrap `resp.json()` in try/catch (edit mode, ~line 259)

**Before:**
```typescript
const data = await resp.json();
```

**After:**
```typescript
let data: any;
try {
  data = await resp.json();
} catch (parseErr) {
  console.error("Failed to parse AI edit response as JSON:", parseErr);
  return new Response(
    JSON.stringify({ error: "AI returned an invalid response. Please try again with a simpler edit." }),
    { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### 2. Same guard for generate mode (~line 351)

Apply the same try/catch around `const data = await resp.json();` in the generate path to prevent the same issue there.

### 3. Same guard for OpenAI fallback (~line 415)

Wrap the OpenAI `resp.json()` call with the same pattern.

## Scope
- 1 file: `supabase/functions/generate-image/index.ts`
- ~15 lines added (3 try/catch blocks)
- No database changes, no frontend changes

