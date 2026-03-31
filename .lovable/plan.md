

# Fix Page Names: Rebar.shop → Correct Names + Add Sattar Page

## Problem
The page names in `PLATFORM_PAGES` constants and existing DB records use incorrect names:
- `"Rebar.shop"` → should be **"Rebar.Shop Incorporated"**
- `"Rebar.shop Ontario"` → should be **"Rebar.Shop Ontario"**
- **"Sattar Esmaeili-Oureh"** missing from LinkedIn pages

## Changes

### 1. Update `src/lib/socialConstants.ts`
- Rename `"Rebar.shop"` → `"Rebar.Shop Incorporated"` in facebook & instagram arrays
- Rename `"Rebar.shop Ontario"` → `"Rebar.Shop Ontario"` in facebook & instagram arrays
- Add `"Sattar Esmaeili-Oureh"` to linkedin pages

### 2. Database migration — fix existing records
Run SQL to update `page_name` in `social_posts` table:
```sql
UPDATE social_posts
SET page_name = REPLACE(
  REPLACE(page_name, 'Rebar.shop Ontario', 'Rebar.Shop Ontario'),
  'Rebar.shop', 'Rebar.Shop Incorporated'
)
WHERE page_name LIKE '%Rebar.shop%';
```
Note: order matters — replace "Rebar.shop Ontario" first to avoid double-replacement.

### 3. Check edge functions for hardcoded page names
- `supabase/functions/ai-agent/index.ts` line 157 has `PIXEL_CONTACT_INFO` with `www.rebar.shop` (this is a URL, not a page name — no change needed)
- No other edge functions reference page names directly

## Impact
- 1 source file changed (`socialConstants.ts`)
- 1 DB migration (UPDATE existing page_name values)
- All existing and future posts will use correct names

