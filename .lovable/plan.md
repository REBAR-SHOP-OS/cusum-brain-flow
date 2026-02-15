

# Verify Write Access to rebar.shop

## What We'll Do
Add a write-access test to the existing `wp-test` edge function. It will:

1. **Create a draft post** with a test title (e.g., "WRITE_TEST — delete me")
2. **Immediately delete it** so it doesn't clutter your site
3. **Report back** whether both operations succeeded

## Current Status
- **Read access**: Confirmed working (retrieved post #21096)
- **Write access**: Not yet tested

## Technical Details

### File: `supabase/functions/wp-test/index.ts`

Update the function to:
1. Keep the existing read test (GET `/posts?per_page=1`)
2. After confirming read works, attempt a **POST** to `/posts` with `{ title: "WRITE_TEST", status: "draft" }`
3. If the draft post is created successfully, immediately **DELETE** it with `?force=true`
4. Return a result object like:
```json
{
  "ok": true,
  "read": { "status": "ok", "sample_post_id": 21096 },
  "write": { "status": "ok", "created_id": 99999, "deleted": true }
}
```

If the write fails (e.g., 401/403), the response will show:
```json
{
  "ok": false,
  "read": { "status": "ok" },
  "write": { "status": "failed", "error": "WP API 403: ..." }
}
```

This is a safe, non-destructive test -- the draft post is created and deleted within the same request, so nothing persists on your live site.

