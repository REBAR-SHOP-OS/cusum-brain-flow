

# Fix: LinkedIn "Not Connected" Error Despite Active Connection

## Root Cause
The LinkedIn publishing functions query `integration_connections` filtered by `user_id`. The user triggering publishes (`b0c1c3d5...`) has **zero** rows in `integration_connections` — they never personally connected LinkedIn. The LinkedIn connection belongs to a different user (`c9b3adc2...`).

For Facebook/Instagram, the code already has a **fallback** pattern: if the current user has no token, it falls back to any user's token. LinkedIn lacks this fallback.

## Fix

### 1. `supabase/functions/social-publish/index.ts` (line ~426-431)
Add fallback query when no LinkedIn connection found for the current user:

```typescript
let { data: connection } = await supabase
  .from("integration_connections")
  .select("config")
  .eq("user_id", userId)
  .eq("integration_id", "linkedin")
  .maybeSingle();

// Fallback: use any user's LinkedIn connection
if (!connection) {
  const { data: fallback } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("integration_id", "linkedin")
    .eq("status", "connected")
    .order("last_sync_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  connection = fallback;
}

if (!connection) return { error: "LinkedIn not connected..." };
```

### 2. `supabase/functions/social-cron-publish/index.ts` (line ~451-456)
Same fallback pattern.

## Files Changed
- `supabase/functions/social-publish/index.ts` — add LinkedIn connection fallback
- `supabase/functions/social-cron-publish/index.ts` — add LinkedIn connection fallback

