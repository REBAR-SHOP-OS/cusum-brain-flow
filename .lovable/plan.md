

# Fix Facebook Publishing — Missing `pages_manage_posts` Scope

## Root Cause
The `facebook-oauth` edge function requests these scopes for Facebook: `pages_show_list, pages_read_engagement, business_management, public_profile`. The critical **`pages_manage_posts`** scope is missing. Without it, the Page Access Token cannot create posts.

## Fix
Add `pages_manage_posts` to the Facebook scopes array in `supabase/functions/facebook-oauth/index.ts` (line 13-18):

```typescript
facebook: [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "public_profile",
],
```

## After the Fix
You will need to **disconnect** and **reconnect** Facebook from the Integrations page so the new scope is requested during OAuth authorization. The old token does not have this permission.

## Files
- **Edit**: `supabase/functions/facebook-oauth/index.ts` — add `pages_manage_posts` to Facebook scopes

