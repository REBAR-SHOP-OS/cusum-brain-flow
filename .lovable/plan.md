

## Fix: Schedule Button Must Create Separate DB Rows Per Page

### Problem
When clicking Schedule with 6 pages selected on a single platform (e.g., Facebook), the edge function's duplicate check blocks clones because it only checks `platform + title + day` — it doesn't distinguish between different `page_name` values. So only the primary post gets scheduled, and the remaining 5 page clones are silently skipped.

### Root Cause
In `supabase/functions/schedule-post/index.ts` (lines 59-66), the duplicate check queries:
```sql
WHERE platform = combo.platform AND title = fullPost.title AND scheduled_date BETWEEN day_start AND day_end
```
This matches the primary post (same platform, same title, same day), so ALL subsequent clones for different pages on the same platform are skipped.

The same issue exists in the frontend fallback duplicate check in `src/lib/schedulePost.ts` (lines 26-41).

### Fix

**1. `supabase/functions/schedule-post/index.ts`** — Add `.eq("page_name", combo.page)` to the clone duplicate check (line 64), so it only blocks if the same platform + title + day + page already exists.

**2. `src/lib/schedulePost.ts`** — Add `.eq("page_name", params.page_name)` to the frontend duplicate check (line 32), so it only blocks if the exact same platform + title + day + page already exists.

### Result
After this fix:
- Scheduling Facebook × 6 pages → creates 1 primary + 5 clones (6 DB rows total)
- Re-opening the card → sibling lookup (already fixed) finds all 6 rows → Pages dropdown shows "(6)"
- True duplicates (same platform + same page + same day) are still blocked

