

## Plan: Hardwire SEO Module to Use ai@rebar.shop Google Connection

### Problem
The SEO module currently checks the **logged-in user's** Google token for GSC/GA4 connection status. But the SEO module should always use `ai@rebar.shop`'s Google connection, regardless of who is logged in. Currently if radin@ logs in, it shows "connected as radin@rebar.shop" — it should always show and use ai@rebar.shop.

### Changes

#### 1. Frontend: `src/components/seo/SeoOverview.tsx`
- Change the `check-status` call to pass a flag `seo_service_account: true` so the edge function knows to look up ai@rebar.shop's token instead of the current user's
- Same for `connectGoogle` and `reconnectGoogle` — these should target ai@rebar.shop

#### 2. Edge Function: `supabase/functions/google-oauth/index.ts`
- In the `check-status` handler: when `seo_service_account: true` is passed, look up the ai@rebar.shop user's token instead of the current user's token
- This way the SEO dashboard always reflects ai@rebar.shop's connection status

#### 3. Edge Function: `supabase/functions/seo-gsc-sync/index.ts`
- Instead of looping through all company profiles to find any token, **prioritize ai@rebar.shop's token first**
- Look up ai@rebar.shop's user_id from auth.users, then check their token in user_gmail_tokens

#### 4. Edge Function: `supabase/functions/seo-smart-scan/index.ts`
- Same approach: when checking if GSC is available, look for ai@rebar.shop's token specifically

#### 5. Memory Update
- Save this rule: "SEO module always uses ai@rebar.shop Google connection for GSC/GA4 data"

### Technical Details

**Lookup pattern (edge functions):**
```typescript
// Find ai@rebar.shop user
const { data: aiUser } = await supabaseAdmin.auth.admin.listUsers();
const aiAccount = aiUser.users.find(u => u.email === "ai@rebar.shop");
if (aiAccount) {
  const { data: tokenRow } = await supabaseAdmin
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted, gmail_email")
    .eq("user_id", aiAccount.id)
    .maybeSingle();
}
```

**Files to modify:**
- `src/components/seo/SeoOverview.tsx` — pass `seo_service_account: true` flag
- `supabase/functions/google-oauth/index.ts` — handle SEO service account lookup
- `supabase/functions/seo-gsc-sync/index.ts` — prioritize ai@rebar.shop token
- `supabase/functions/seo-smart-scan/index.ts` — use ai@rebar.shop for GSC check

### Result
SEO module always uses ai@rebar.shop's Google connection for all GSC and GA4 operations, regardless of which user is logged in.

