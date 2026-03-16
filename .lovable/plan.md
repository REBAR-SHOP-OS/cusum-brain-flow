

# Fix Image Edit "Rate limit exceeded" Error

## Problem
When editing images in the ImageEditDialog, the Lovable AI gateway returns a 429 rate limit error. The current code has no retry logic for rate-limited requests — it fails immediately and shows the error toast.

## Solution
Add automatic retry with exponential backoff for 429 (rate limit) errors in two places:

### 1. Edge Function: `supabase/functions/generate-image/index.ts`
- Wrap the AI gateway call in the **edit mode** section (lines 188-211) with a retry loop (up to 3 attempts)
- On 429, wait 2s → 4s before retrying
- Only retry on 429; other errors fail immediately as before

### 2. Client: `src/components/social/ImageEditDialog.tsx`
- Increase the timeout from 60s to 90s (to account for backend retries)
- Add `retries: 1` to `invokeEdgeFunction` options so the client also retries once on timeout

### What changes

**`generate-image/index.ts`** — edit mode AI call (around line 188):
```typescript
// Retry loop for rate limits
let resp: Response | null = null;
for (let attempt = 0; attempt < 3; attempt++) {
  resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { ... });
  if (resp.status !== 429 || attempt === 2) break;
  const wait = (attempt + 1) * 2000;
  console.log(`Rate limited on edit attempt ${attempt + 1}, waiting ${wait}ms...`);
  await new Promise(r => setTimeout(r, wait));
}
```

**`ImageEditDialog.tsx`** — increase timeout:
```typescript
const data = await invokeEdgeFunction<{ imageUrl: string }>("generate-image", {
  ...
}, { timeoutMs: 90000, retries: 1 });
```

This gives the system up to 3 backend attempts with backoff, plus 1 client-level retry — significantly reducing the chance of a user-facing rate limit error.

