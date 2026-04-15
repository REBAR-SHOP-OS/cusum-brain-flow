

## Plan: Fix Smart Scan "0 Sources" + Tasks Not Showing

### Root Causes Found

**Problem 1: Smart Scan shows 0 sources synced**
The `seo-smart-scan` function calls child functions (seo-gsc-sync, wincher-sync, seo-site-crawl, seo-keyword-harvest) via `fetch()` using `Authorization: Bearer ${serviceKey}` (service role key). These child functions use `authMode: "required"` which calls `getClaims()` — but the service role JWT has no `sub` claim, so authentication fails with "Invalid token" for every sub-call. Result: nothing syncs, no tasks created.

**Problem 2: Tasks list shows 0 despite 15 tasks in database**
The database has 15 seo_tasks (2 open, 8 in_progress, 5 done). RLS policy matches the user's company. Most likely the `fetchAllRows` query is failing silently, or the CSS-based mount from SeoModule changes caused a timing issue. Need to add error handling and verify the query works.

### Fix

#### 1. Fix auth for internal sub-calls in `seo-smart-scan/index.ts`
The child edge functions need to accept service-role calls. The cleanest approach: add **service role key detection** to the shared `_shared/auth.ts` `requireAuth` function. If the bearer token matches the service role key, skip `getClaims()` and return a system-level context.

**File: `supabase/functions/_shared/auth.ts`**
- In `requireAuth()`: before calling `getClaims()`, check if the bearer token equals `SUPABASE_SERVICE_ROLE_KEY`. If so, return `userId: "service_role"` with a service client. This allows internal function-to-function calls.

#### 2. Add error logging to SeoTasks query
**File: `src/components/seo/SeoTasks.tsx`**
- Add `console.error` in the query's error path and ensure `fetchAllRows` errors are caught and displayed.
- Add a fallback direct query (without `fetchAllRows`) if the paginated fetch fails, to rule out the utility as the cause.

#### 3. Verify SeoTasks actually loads when mounted via CSS
Since `SeoModule.tsx` now uses `display: none/block` pattern, all components mount at once. Verify the seo-tasks query fires on initial mount and data populates correctly.

### Files to modify
- `supabase/functions/_shared/auth.ts` — detect service role key in `requireAuth()`
- `src/components/seo/SeoTasks.tsx` — add error handling/logging to diagnose empty tasks
- Redeploy all SEO edge functions after auth.ts change

### Result
- Smart Scan will successfully call all sub-functions (GSC, Wincher, site crawl, keyword harvest)
- Tasks will appear correctly in the Open/In Progress/Done columns
- New tasks from Smart Scan will be created and immediately visible

