

# Fix: Instagram Pages Failing Due to Transient API Errors

## Root Cause

From the edge function logs, the problem is clear: when publishing to Instagram, all 5 IG accounts are called **simultaneously via `Promise.allSettled`**. Instagram's API rate-limits concurrent requests from the same user token and returns transient errors:

```
Instagram container error: {
  message: "An unexpected error has occurred. Please retry your request later.",
  type: "OAuthException",
  is_transient: true,   ← Instagram explicitly says "retry"
  code: 2
}
```

- First publish: Rebar.shop **failed**, other 4 succeeded
- Second publish: Rebar.shop Ontario **failed**, other 4 succeeded

Each time, one random account fails because of concurrent API pressure.

## Fix

### File: `supabase/functions/social-publish/index.ts`

**Add retry logic with staggered delays in `publishToInstagram`** (around lines 614-625):

When the container creation returns a transient error (`is_transient: true` or error code 2), retry up to 2 times with a 3-second delay between attempts. This is the standard approach recommended by Meta's API docs for transient errors.

```typescript
// In publishToInstagram(), around the container creation (line 615-625):
// Wrap container creation in a retry loop
let containerData: any;
for (let attempt = 0; attempt < 3; attempt++) {
  const containerRes = await fetch(`${GRAPH_API}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  containerData = await containerRes.json();
  
  if (containerData.error?.is_transient && attempt < 2) {
    console.warn(`[IG] Transient error on attempt ${attempt + 1}, retrying in 3s...`);
    await new Promise(r => setTimeout(r, 3000));
    continue;
  }
  break;
}

if (containerData.error) {
  return { error: `Instagram: ${containerData.error.message}` };
}
```

Additionally, **stagger the parallel IG publish calls** (around lines 432-450) by adding a small delay between each account to reduce concurrent API pressure:

```typescript
// Instead of firing all at once, stagger by 1s each
igPublishQueue.map(({ ... }, index) =>
  new Promise(r => setTimeout(r, index * 1000)).then(() =>
    publishToInstagram(...)
  )
)
```

## Impact

- Only modifies Instagram publishing retry behavior — no other platform or flow affected
- Facebook publishing (already sequential and working) is untouched
- Staggering + retry should eliminate the random transient failures completely

## Files Changed
- `supabase/functions/social-publish/index.ts` — add retry loop for transient IG errors + stagger parallel calls

