

## Plan: Maximum SEMrush Data Pull Before Cancellation

### Current Problem
Your SEMrush API units balance is **zero**. All calls are returning `ERROR 403 :: ERROR 132 :: API UNITS BALANCE IS ZERO`. You need to either:
1. Wait for your monthly API units to reset, or
2. Purchase additional API units from your SEMrush account

**No code changes can fix this** -- the API is rejecting requests because you have no remaining units.

### What We Already Pull (7 endpoints)
| Endpoint | What it gets | Saved to DB? |
|----------|-------------|--------------|
| `domain_ranks` (overview) | Authority, traffic, cost | Yes - `seo_domains` |
| `domain_organic` | Organic keywords (500/db) | Yes - `seo_keyword_ai` |
| `domain_organic_organic` | Competitors | No - returned only |
| `domain_adwords` | Paid keywords | No - returned only |
| `domain_rank_history` | 24-month rank history | No - returned only |
| `backlinks_overview` | Backlink totals | No - returned only |
| `backlinks_refdomains` | Referring domains list | No - returned only |

### What We Should Add (maximize value before cancelling)

Based on the SEMrush API docs, these additional endpoints would give you data you can keep forever in your database:

1. **Domain Organic Pages** (`domain_organic_organic` type=`domain_organic_pages`) -- Which pages on your site drive organic traffic, with per-page keyword counts and traffic. Save to `seo_page_ai`.

2. **Related Keywords** (`phrase_related`) -- For each of your top keywords, pull related keyword ideas with volume/difficulty. Save to `seo_keyword_ai`.

3. **Broad Match Keywords** (`phrase_fullsearch`) -- Broader keyword variations. Save to `seo_keyword_ai`.

4. **Phrase Questions** (`phrase_questions`) -- Question-based keywords (great for content). Save to `seo_keyword_ai`.

5. **Backlinks list** (`backlinks`) -- Individual backlink URLs (not just referring domains). Could save to a new table or JSON field.

6. **Domain Overview All DBs** (`domain_ranks_all`) -- Get data across ALL regional databases in one call (more efficient than calling US + CA separately).

7. **Keyword Intent data** -- Add `In` (Intent) column to organic keyword pulls to classify commercial/informational/navigational/transactional intent.

### Implementation Changes

**Edge Function (`semrush-api/index.ts`):**
- Add 5 new action handlers: `domain_organic_pages`, `related_keywords`, `broad_match_keywords`, `phrase_questions`, `backlinks_list`
- Expand `domain_organic` export columns to include `In` (intent), `Tg` (traffic amount), `Ts` (timestamp)
- Increase organic keyword limit from 500 to **10,000** per database to pull ALL keywords
- Save competitors, backlinks, and rank history to DB instead of just returning them
- Add graceful handling for `API UNITS BALANCE IS ZERO` errors (return cached data instead of 500)

**Frontend (`useSemrushApi.ts`):**
- Update `fullExport` to include the new endpoints
- Increase organic keyword limit from 500 to 10,000
- Handle zero-balance errors gracefully with a clear user message like "SEMrush API units exhausted. Top up at semrush.com to continue syncing."

**Database migration:**
- Add `semrush_competitors_json`, `semrush_backlinks_json`, `semrush_rank_history_json` columns to `seo_domains` to persist competitor/backlink/history data
- Add `intent` enrichment to `seo_keyword_ai` (column already exists)

### Important Note
Before running the full export, you must have API units available. Once your units reset or you purchase more, the "Full Export" button will pull everything and save it permanently to your database so you keep the data after cancelling SEMrush.

