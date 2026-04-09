

# Fix: LinkedIn Publishing Failed — Organization ID Not Configured

## Problem
LinkedIn posts fail with: *"LinkedIn organization ID not configured for 'Rebar.shop Ontario, Rebar.shop, Sattar Esmaeili-Oureh'"*

## Root Cause (Two Issues)

### Issue 1 — Personal profile not detected in comma-separated page_name
Both `social-publish` and `social-cron-publish` check:
```ts
const isPersonal = !pageName || pageName === "Sattar Esmaeili-Oureh";
```
When `page_name` is `"Rebar.shop Ontario, Rebar.shop, Sattar Esmaeili-Oureh"`, `isPersonal` is `false`. The code falls through to the org branch, which has no `organization_ids` and fails.

### Issue 2 — LinkedIn connection missing org scopes
The two existing LinkedIn connections have scope `w_member_social` only. The OAuth flow requests `w_organization_social` and `r_organization_social`, but these connections were created before that code was added. Without those scopes, the auto-discovery of organization IDs cannot work.

## Fix

### Step 1 — Code: Smarter personal vs org detection (2 files)

**Files:** `supabase/functions/social-publish/index.ts` and `supabase/functions/social-cron-publish/index.ts`

Replace the rigid `isPersonal` check with logic that splits comma-separated pages and handles the personal profile name correctly:

```ts
// Before:
const isPersonal = !pageName || pageName === "Sattar Esmaeili-Oureh";

// After:
const pageList = (pageName || "").split(",").map(s => s.trim()).filter(Boolean);
const personalName = config.profile_name || "Sattar Esmaeili-Oureh";
const isPersonal = pageList.length === 0 || (pageList.length === 1 && pageList[0] === personalName);

// For org publishing, filter out the personal name from the page list
const orgPages = pageList.filter(p => p !== personalName);
```

Then when looking up org IDs, iterate only over `orgPages` instead of the full comma-separated string.

### Step 2 — Reconnect LinkedIn with organization scopes

After deploying the code fix, LinkedIn must be reconnected so the OAuth flow grants `w_organization_social` + `r_organization_social` and auto-discovers org IDs for "Rebar.shop Ontario" and "Rebar.shop".

### Step 3 — Retry failed posts

Once reconnected, the failed LinkedIn posts can be retried using the existing "Retry Publishing" button.

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/social-publish/index.ts` | Fix `isPersonal` detection + filter org pages |
| `supabase/functions/social-cron-publish/index.ts` | Same fix |

## What Won't Change
- OAuth flow already requests correct scopes (line 198 in `linkedin-oauth`)
- Auto-discovery logic already works in callback
- No database changes needed

