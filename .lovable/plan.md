

## Strip Persian Text Before Publishing

### Problem
The `---PERSIAN---` translation block is stored inside the `content` field of social posts. When publishing (both manual and cron), the raw `content` is sent directly to Facebook/Instagram/LinkedIn/Twitter APIs — including the Persian text. The Persian section is only meant for internal review, never for publishing.

### Root Cause
Two publish paths assemble the message without stripping Persian:
1. **`src/hooks/usePublishPost.ts`** (manual publish) — line 34-37
2. **`supabase/functions/social-cron-publish/index.ts`** (scheduled publish) — line 112-115

Both do: `message = post.content + hashtags` — no filtering.

Note: `AgentWorkspace.tsx` already strips Persian when saving from Pixel agent (line 373-379), but posts created via `auto-generate-post` store the full content including Persian directly into the database.

### Fix

#### 1. Create a shared `stripPersian` utility function
A simple function that removes everything from `---PERSIAN---` onward, plus fallback Persian markers (`🖼️ متن روی عکس:` blocks).

#### 2. Apply in `src/hooks/usePublishPost.ts`
Strip Persian from `post.content` before building the message sent to the API.

#### 3. Apply in `supabase/functions/social-cron-publish/index.ts`
Strip Persian from `post.content` before building the message for all platforms.

#### 4. Apply in `supabase/functions/social-publish/index.ts`
Add server-side stripping as a safety net — even if the client sends Persian text, the server will remove it before calling the platform API.

#### 5. Fix `supabase/functions/auto-generate-post/index.ts`
Strip Persian from content **before** inserting into the database, so the stored content is always clean. The Persian block should only exist in the agent chat display, not in the DB record.

### Technical Detail
```typescript
function stripPersian(text: string): string {
  // Remove ---PERSIAN--- block and everything after
  const idx = text.indexOf("---PERSIAN---");
  if (idx !== -1) text = text.slice(0, idx);
  // Remove fallback Persian markers
  text = text.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
  return text.trim();
}
```

### Files
1. `src/hooks/usePublishPost.ts` — strip before sending
2. `supabase/functions/social-cron-publish/index.ts` — strip before publishing
3. `supabase/functions/social-publish/index.ts` — server-side safety strip
4. `supabase/functions/auto-generate-post/index.ts` — strip before DB insert

