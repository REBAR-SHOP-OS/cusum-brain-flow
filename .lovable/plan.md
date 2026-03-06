
# Fix: Scheduled Posts Not Publishing to Correct Instagram Page

## Current Status (after previous fixes)
- ✅ Cron function auth (401) — **fixed**
- ✅ Set Date button clickable (pointer-events) — **fixed**
- ✅ Trigger allows scheduled transition — **working**

## Remaining Bug: Wrong Instagram Account Selection

The cron function has a critical bug in Instagram publishing. When a post has `page_name: "Rebar.shop"`, the code correctly matches the Facebook page (id: `101433255155689`), but then **ignores the match** and always uses `igAccounts[0]` (which is `ontariosteeldetailing`, NOT `rebar.shop`).

Each IG account in the token data has a `pageId` field that maps to the corresponding Facebook page. The fix: match the IG account by `pageId === selectedPage.id`.

### File: `supabase/functions/social-cron-publish/index.ts` (lines 96-101)

**Before:**
```typescript
const igAccounts = (tokenData.instagram_accounts as Array<{ id: string }>) || [];
if (igAccounts.length === 0) {
  publishResult = { error: "No Instagram Business Account found" };
} else {
  publishResult = await publishToInstagram(igAccounts[0].id, pageAccessToken, message, post.image_url);
}
```

**After:**
```typescript
const igAccounts = (tokenData.instagram_accounts as Array<{ id: string; pageId?: string }>) || [];
if (igAccounts.length === 0) {
  publishResult = { error: "No Instagram Business Account found" };
} else {
  // Match IG account to the selected Facebook page
  const matchedIg = igAccounts.find(ig => ig.pageId === pageId) || igAccounts[0];
  publishResult = await publishToInstagram(matchedIg.id, pageAccessToken, message, post.image_url);
}
```

This single change ensures that when a post is scheduled for "Rebar.shop", it publishes to the `rebar.shop` Instagram account (not `ontariosteeldetailing`).

### Additional Robustness: Ensure `page_name` is always saved

The `onSetDate` handler already sets `page_name: post.page_name || localPages[0] || null`, which should work. No change needed there.

### Summary
One targeted fix in the cron edge function to match the correct Instagram account based on page mapping. Combined with the two previous fixes (auth 401 and pointer-events), this completes the end-to-end scheduled publishing flow.
