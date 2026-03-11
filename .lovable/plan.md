

## Prevent Duplicate Publishing

### Problem
There is no guard against publishing a post that has already been published. A user could click "Publish Now" on an already-published post, or the cron job could pick up a post that was just published manually. This could lead to duplicate content on social platforms.

### Current Gaps
1. **`usePublishPost.ts`** (frontend): No status check before calling the edge function
2. **`social-publish/index.ts`** (edge function): Updates status to "published" but never checks if it's already published
3. **`social-cron-publish/index.ts`**: Queries `status = "scheduled"` which is safer, but has no lock against race conditions with manual publishing
4. **`PostReviewPanel.tsx`**: The `isPublished` guard already hides the button, but the hook itself has no protection

### Changes

#### 1. `src/hooks/usePublishPost.ts`
Add a pre-check: fetch the post's current status before invoking the edge function. If `status === "published"`, abort with a toast warning.

```typescript
// Before calling social-publish:
const { data: current } = await supabase
  .from("social_posts")
  .select("status")
  .eq("id", post.id)
  .single();

if (current?.status === "published") {
  toast({ title: "Already published", description: "This post has already been published.", variant: "destructive" });
  return false;
}
```

#### 2. `supabase/functions/social-publish/index.ts`
Add a server-side guard after parsing the request body: if `post_id` is provided, check its current status. If already "published", return an error immediately without calling any external API.

```typescript
if (post_id) {
  const { data: existing } = await supabaseAdmin
    .from("social_posts")
    .select("status")
    .eq("id", post_id)
    .single();
  if (existing?.status === "published") {
    return new Response(
      JSON.stringify({ error: "This post has already been published." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

#### 3. `supabase/functions/social-cron-publish/index.ts`
Add a re-check before each post is published in the loop: re-fetch the post status to guard against race conditions where a manual publish happened between the initial query and the actual publish call.

```typescript
// Inside the for loop, before publishing:
const { data: freshPost } = await supabase
  .from("social_posts")
  .select("status")
  .eq("id", post.id)
  .single();
if (freshPost?.status === "published") {
  console.log(`Skipping ${post.id} — already published`);
  continue;
}
```

### Summary
Three layers of protection: frontend pre-check, edge function guard, and cron job re-verification. This ensures no post is ever sent to a social platform twice.

