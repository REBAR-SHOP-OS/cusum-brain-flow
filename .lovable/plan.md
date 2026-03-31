

# Prevent Duplicate & Wrong-Target Publishing — Remove Fallback Logic

## Problem
Both `social-cron-publish` and `social-publish` have a dangerous fallback: when a page name from the `page_name` field doesn't match any page in the Facebook token data, they **fall back to the first page** (`pages[0]`). This means unrelated page names (e.g. "Rebar.shop" on a LinkedIn card that somehow leaked into page_name) get published to the wrong account.

```text
page_name: "Ontario Steel Detailing, Rebar.shop, Ontario Logistics"
Platform: facebook

"Ontario Steel Detailing" → matched → pageId A → PUBLISH ✅
"Rebar.shop"              → matched → pageId B → PUBLISH ✅
"Ontario Logistics"        → matched → pageId C → PUBLISH ✅
"SomeUnknownPage"         → NO MATCH → pages[0] → DUPLICATE! ❌
```

The Set-based dedup (already added) catches some cases, but the real fix is: **if a page name doesn't match, SKIP it entirely**.

## Rule Being Enforced
> هر کارتی که اسکجوال شده و تایید شده، فقط براساس ساعت و پلتفرم و پیج‌هایی که مشخص شده پابلیش شود — بدون هیچ fallback.

## Changes

### 1. `supabase/functions/social-cron-publish/index.ts`
**Line 278-286** — Remove fallback to `pages[0]` when page name doesn't match:
```typescript
// BEFORE (dangerous):
let selectedPage = pages[0];
if (targetPageName) {
  const matched = pages.find(...);
  if (matched) selectedPage = matched;
  else console.warn("...using first page");
}

// AFTER (safe):
if (targetPageName) {
  const matched = pages.find(p => p.name === targetPageName);
  if (!matched) {
    console.warn(`[social-cron-publish] SKIP — page "${targetPageName}" not found in token. Will NOT fall back.`);
    pageErrors.push(`Page "${targetPageName}": not found in connected pages — skipped`);
    continue;
  }
  selectedPage = matched;
}
```

**Line 368** — Same for Instagram: if no IG account matches the pageId, skip instead of `igAccounts[0]`:
```typescript
// BEFORE:
const matchedIg = igAccounts.find(ig => ig.pageId === pageId) || igAccounts[0];

// AFTER:
const matchedIg = igAccounts.find(ig => ig.pageId === pageId);
if (!matchedIg) {
  console.warn(`[social-cron-publish] SKIP — no IG account linked to FB page ${pageId} ("${targetPageName}")`);
  pageErrors.push(`Page "${targetPageName}": no linked Instagram account — skipped`);
  continue;
}
```

### 2. `supabase/functions/social-publish/index.ts`
**Line 200-204** — Same fix: skip unmatched pages instead of falling back:
```typescript
if (targetPageName) {
  const matched = pages.find(p => p.name === targetPageName);
  if (!matched) {
    console.warn(`[social-publish] SKIP — page "${targetPageName}" not found`);
    pageErrors.push(`Page "${targetPageName}": not found — skipped`);
    continue;
  }
  selectedPage = matched;
}
```

**Line 276** — Same for Instagram:
```typescript
const selectedIg = igAccounts.find(ig => ig.pageId === pageId);
if (!selectedIg) {
  console.warn(`[social-publish] SKIP — no IG account for FB page ${pageId}`);
  pageErrors.push(`Page "${targetPageName}": no linked IG account — skipped`);
  continue;
}
```

### 3. Keep existing dedup Sets as secondary safety
The `publishedFbPageIds` and `publishedIgIds` Sets remain as a secondary guard — even if somehow two page names resolve to the same account, the Set prevents double-publishing.

## Impact
- **No more wrong-target publishing**: unmatched pages are skipped, not defaulted
- **No more duplicate publishing**: Set dedup + no-fallback = double protection
- **Partial success still works**: if 4 out of 5 pages succeed, post is still marked published with partial error logged
- **No frontend or schema changes needed**

