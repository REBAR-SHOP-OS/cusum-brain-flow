

## Root Cause: Why Scheduled Posts Never Publish

The cron job IS running correctly every 5 minutes and IS finding scheduled posts. The problem is a **user ID mismatch for token lookup**.

### Evidence

| What | Value |
|------|-------|
| Post owner (`user_id`) | `b0c1c3d5-...` |
| Meta tokens belong to | `be3b9444-...` |
| Cron looks up tokens by | `post.user_id` → finds nothing → **"instagram not connected for user"** |

**Why manual publish works**: When you click "Publish" manually, the `social-publish` edge function uses your **logged-in session JWT** (`auth.getClaims`) to find the token — NOT the post's `user_id`. If the logged-in user (`be3b9444`) has the tokens, it works.

**Why cron fails**: The cron job has no logged-in user. It uses `post.user_id` (`b0c1c3d5`) to look up tokens. That user has zero tokens in `user_meta_tokens` → instant failure.

### Fix

**File: `supabase/functions/social-cron-publish/index.ts`** — Add a fallback token lookup.

When `post.user_id` has no token, search for **any team member's token** for that platform:

```typescript
// Current (line 109-114):
const { data: tokenData } = await supabase
  .from("user_meta_tokens")
  .select("access_token, pages, instagram_accounts")
  .eq("user_id", post.user_id)
  .eq("platform", tokenPlatform)
  .maybeSingle();

// Fixed — add fallback:
let tokenData = ...same query...;
if (!tokenData) {
  // Fallback: use any available token for this platform
  const { data: fallback } = await supabase
    .from("user_meta_tokens")
    .select("access_token, pages, instagram_accounts")
    .eq("platform", tokenPlatform)
    .limit(1)
    .maybeSingle();
  tokenData = fallback;
}
```

Same fallback for the page-specific token lookup at line 130-135.

This is a single-file change in the cron function. The manual publish flow is unaffected.

