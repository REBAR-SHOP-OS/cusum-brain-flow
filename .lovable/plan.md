

# Root Cause: "Rebar.Shop Incorporated" Does Not Exist in Facebook/Instagram

## Problem

The UI lists the page as **"Rebar.Shop Incorporated"** (`socialConstants.ts` line 10, 18), but the actual Facebook/Instagram page name stored in `user_meta_tokens.pages` is **"Rebar.shop"** (lowercase "s", no "Incorporated").

When the backend tries to match `"Rebar.Shop Incorporated"` against available pages `["Ontario Steel Detailing", "Rebar.shop", "Ontario Digital Marketing", ...]`, the `normalizePageName` function compares:
- `"rebar.shop incorporated"` vs `"rebar.shop"` → **no match**

Result: every publish attempt for this page hits line 294:
```
SKIP — page "Rebar.Shop Incorporated" not found in connected pages — skipped
```

This is the same root cause for all posts that include "Rebar.Shop Incorporated" — they silently skip that page or fail entirely.

## Fix

### 1. Update `src/lib/socialConstants.ts` — rename to match Facebook

Change "Rebar.Shop Incorporated" → "Rebar.shop" in both facebook and instagram arrays. This matches the actual page name from Meta's API stored in `user_meta_tokens`.

### 2. Database migration — update existing posts

Run a data migration to rename "Rebar.Shop Incorporated" → "Rebar.shop" in all `social_posts.page_name` values (both standalone and within comma-separated strings).

```sql
UPDATE social_posts 
SET page_name = REPLACE(page_name, 'Rebar.Shop Incorporated', 'Rebar.shop')
WHERE page_name LIKE '%Rebar.Shop Incorporated%';
```

### 3. Also fix "Rebar.Shop Ontario" → "Rebar.shop Ontario"

The token data shows `"Rebar.shop Ontario"` (lowercase "s") but the constants have `"Rebar.Shop Ontario"` (uppercase "S"). The `normalizePageName` function lowercases both so this works today, but it should be consistent to avoid confusion.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/socialConstants.ts` | Rename "Rebar.Shop Incorporated" → "Rebar.shop" |
| Database migration | Update existing `page_name` values |

## Safety
- `normalizePageName` lowercases, so case differences are safe — but "Incorporated" suffix is a completely different string, which is why it fails
- Migration only touches `page_name` text, no structural changes
- No edge function changes needed — the matching logic is correct, the data is wrong

