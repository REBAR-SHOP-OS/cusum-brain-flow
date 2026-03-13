

# Fix Facebook Publishing Errors

## Root Causes Found

**Error 1: "Validation failed"** — The post has platforms "unassigned, Facebook". When publishing, the code loops through ALL selected platforms including "unassigned". Since "unassigned" is not in the Zod enum `["facebook", "instagram", "linkedin", "twitter"]`, the edge function returns a validation error.

**Error 2: "facebook not connected"** — The `ai@rebar.shop` user (ID `b2b75b2e-...`) has NO tokens in `user_meta_tokens`. Facebook tokens are stored under user `c9b3adc2-...` (whoever originally connected Facebook). The edge function only looks up tokens by the currently authenticated user's ID, so it fails.

## Changes

### 1. `src/components/social/PostReviewPanel.tsx` — Filter out "unassigned" from publish combos

In the Publish Now onClick handler (~line 760), filter `localPlatforms` to exclude "unassigned" before building combos:

```typescript
const publishablePlatforms = localPlatforms.filter(p => p !== "unassigned");
if (publishablePlatforms.length === 0) {
  toast({ title: "No publishable platform", description: "Please select a platform (not 'unassigned').", variant: "destructive" });
  return;
}
// use publishablePlatforms instead of localPlatforms for combos
```

### 2. `supabase/functions/social-publish/index.ts` — Fallback to any available token

When the current user has no token for the platform, fall back to any user's token in the system. This allows `ai@rebar.shop` to publish using the Facebook tokens connected by another team member.

Change lines 135-147: after the initial lookup by `userId` fails, do a second query without the `user_id` filter to find any available token:

```typescript
// First try current user
let tokenData = ...eq("user_id", userId)...
// If not found, fallback to any user's token
if (!tokenData) {
  tokenData = ...without user_id filter...order by created_at desc...
}
```

### Files
- `src/components/social/PostReviewPanel.tsx` — filter "unassigned" from publish
- `supabase/functions/social-publish/index.ts` — fallback token lookup

