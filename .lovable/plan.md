

# Fix Deploy Timeout + Publish Now Error

## Problem 1: Edge Function Deploy Timeout
The project has **150+ edge functions**. The "Bundle generation timed out" error is a transient deployment infrastructure issue — the bundler can't process all functions within the time limit. This is **not a code bug**. Retrying the deploy (by making a small change or re-publishing) usually resolves it. No code change needed.

## Problem 2: "Publish Now" Shows Generic Error
When `supabase.functions.invoke()` gets a non-2xx response, the `error` object is a `FunctionsHttpError` with a generic message. The real API error (e.g., "Facebook: requires pages_manage_posts permission") is buried in the response body but never parsed.

## Problem 3: Connection Question
The user asks "where should we connect?" — this refers to the Facebook permissions error from the screenshot. The Facebook/Instagram pages need to be **reconnected** with proper permissions (`pages_manage_posts`, `pages_read_engagement`) via the Integrations page.

## Plan

### 1. Fix error parsing in `src/hooks/usePublishPost.ts`
Parse the edge function's response body to extract the real error message:

```typescript
const { data, error } = await supabase.functions.invoke("social-publish", { body: { ... } });

if (error) {
  // Try to extract the real error from the response body
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

### 2. Reconnect Facebook Integration
After the fix, the real error will be visible (e.g., "requires pages_manage_posts permission"). The user should go to **Integrations → Facebook → Disconnect → Reconnect** to re-authorize with the correct permissions. No code change needed for this — it's a configuration step.

### 3. Deploy Timeout
This is transient. The deploy will be retried automatically after the code change above.

## Files
- **Edit**: `src/hooks/usePublishPost.ts` — better error extraction from edge function responses

