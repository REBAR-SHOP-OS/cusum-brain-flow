

# Fix Duplicate Instagram Publishing — Deduplicate by Actual Account ID

## Problem
When a post has multiple pages in `page_name` (e.g., `"Ontario Steel Detailing, Rebar.shop, Ontario Logistics"`), both `social-cron-publish` and `social-publish` split this string and loop through each page name, publishing separately. However, multiple page names can resolve to the **same Instagram Business Account** (via the `igAccounts[0]` fallback when no match is found). This causes the same content to appear 2-3 times on the same Instagram account.

## Root Cause
```text
page_name: "Ontario Steel Detailing, Rebar.shop, Ontario Logistics"
                    ↓                    ↓                ↓
              FB Page A             FB Page B         FB Page C
                    ↓                    ↓                ↓
         IG match found?        IG match found?    IG match found?
              YES → ig1              NO → ig1 (fallback!)   NO → ig1 (fallback!)
                    ↓                    ↓                ↓
             PUBLISH ✅          PUBLISH ✅ (DUPLICATE!)   PUBLISH ✅ (DUPLICATE!)
```

The `igAccounts.find(ig => ig.pageId === pageId) || igAccounts[0]` fallback means unmatched pages all default to the first IG account, causing duplicates.

## Fix — Two Files

### 1. `supabase/functions/social-cron-publish/index.ts` (lines ~352-373)
- Before the Instagram publishing loop, create a `Set<string>` called `publishedIgAccountIds`
- After resolving `matchedIg`, check if `matchedIg.id` is already in the Set
- If yes, skip publishing and log `"Skipping — already published to IG account {id} via another page"`
- If no, add to Set and proceed with publish

### 2. `supabase/functions/social-publish/index.ts` (lines ~260-278)
- Same deduplication logic: track published IG account IDs across the page loop
- Skip pages that resolve to an already-published IG account

### Code Change (both files, same pattern)
```typescript
// Add before the page loop (around line 274 in cron, line 197 in publish)
const publishedIgIds = new Set<string>();

// Inside the Instagram branch, after resolving matchedIg:
if (publishedIgIds.has(matchedIg.id)) {
  console.log(`[social-cron-publish] Skipping page "${targetPageName}" — IG account ${matchedIg.id} already published`);
  pageSuccesses.push(targetPageName); // count as success (already done)
  continue;
}
publishedIgIds.add(matchedIg.id);
```

Also apply the same pattern for Facebook (`pageId` dedup) to prevent edge cases where multiple page names resolve to the same Facebook Page ID.

### 3. Additional Safety: Facebook dedup
```typescript
const publishedFbPageIds = new Set<string>();

// Inside the Facebook branch, after resolving pageId:
if (publishedFbPageIds.has(pageId)) {
  console.log(`[...] Skipping page "${targetPageName}" — FB page ${pageId} already published`);
  pageSuccesses.push(targetPageName);
  continue;
}
publishedFbPageIds.add(pageId);
```

## Impact
- No schema changes needed
- No frontend changes needed
- Fixes both manual publish and cron-based auto-publish
- Existing posts are unaffected (already published)

