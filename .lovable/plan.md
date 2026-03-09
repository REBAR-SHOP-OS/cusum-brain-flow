

# Fix "Publish Now" Error — Root Cause & Solution

## Problem
Two issues found:

1. **Error message is hidden**: When the edge function returns a non-2xx status (e.g. 400), `supabase.functions.invoke()` puts the error in `error` as a `FunctionsHttpError` object with a generic message "Edge Function returned a non-2xx status code". The actual error from the response body (e.g. "Facebook: (#200) requires pages_manage_posts permission...") is never parsed or shown to the user.

2. **Facebook permissions error**: The actual API error from Facebook is a permissions issue — the page token lacks `pages_read_engagement` and `pages_manage_posts`. This likely means the Facebook OAuth token needs to be refreshed with the correct scopes. (This is a configuration/reconnection issue, not a code bug.)

## Fix

### `src/hooks/usePublishPost.ts`
Parse the `FunctionsHttpError` response body to extract the real server-side error message:

```typescript
if (error) {
  // Parse the actual error from the edge function response body
  let serverMsg = error.message;
  try {
    if (error.context?.body) {
      const body = await new Response(error.context.body).json();
      if (body?.error) serverMsg = body.error;
    }
  } catch {}
  throw new Error(serverMsg);
}
```

This surfaces the actual Facebook/Instagram/LinkedIn error instead of the generic "non-2xx" message, making debugging much easier.

### Facebook Token Fix
The user will also need to reconnect their Facebook integration with the correct page permissions (`pages_read_engagement`, `pages_manage_posts`). This is not a code change — it's a reconnection step. After the code fix, the real error message will be visible, guiding them.

## Files to edit
- `src/hooks/usePublishPost.ts` — improve error parsing

