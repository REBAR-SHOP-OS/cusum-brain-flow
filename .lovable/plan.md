

# Fix: `regenerate-post` Edge Function Runtime Error

## Problem
The `regenerate-post` function fails with `RUNTIME_ERROR` at line 0 with **zero logs**, indicating it either crashes on boot or times out before producing any output. Two root causes:

1. **Client-side timeout**: All 3 call sites use `supabase.functions.invoke()` which has a ~30s default timeout. The function does caption generation + image generation (multiple AI model attempts with retry), easily taking 60-120s. The SDK aborts the request, and the swallowed error body produces `RUNTIME_ERROR`.

2. **No error boundary**: The blank screen (`has_blank_screen: true`) suggests the unhandled error propagates and crashes the React render tree.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx`
Replace all 3 instances of `supabase.functions.invoke("regenerate-post", ...)` with `invokeEdgeFunction("regenerate-post", ..., { timeoutMs: 120000 })` from the project's existing utility. This gives 120s for the AI generation + image upload to complete, and properly surfaces server error messages.

Three call sites to update:
- ~Line 213 (caption-only regenerate for video)
- ~Line 425 (full regenerate) 
- ~Line 597 (caption-only regenerate)

Each needs:
- Import `invokeEdgeFunction` from `@/lib/invokeEdgeFunction`
- Replace `const { data, error } = await supabase.functions.invoke(...)` with `const data = await invokeEdgeFunction("regenerate-post", body, { timeoutMs: 120000 })`
- Remove the separate `if (error) throw error` check (invokeEdgeFunction throws directly)

### 2. Deploy `regenerate-post`
Redeploy the edge function to ensure the latest code is live (no logs suggests it may not be deployed or has a stale version).

## Why This Fixes It
The `invokeEdgeFunction` utility uses raw `fetch` with an explicit `AbortController` timeout (120s), matching the pattern already used in `usePublishPost` and `useAutoGenerate`. This prevents premature client-side abort while the server is still processing AI calls.

