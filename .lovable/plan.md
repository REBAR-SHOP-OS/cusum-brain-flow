

# Mine SEO Reports from Gmail (SEMrush, Wincher, Yoast)

Your Gmail already has rich SEO reports from SEMrush (Position Tracking, Site Audit), Wincher (ranking notifications), and Yoast landing in your inbox. The current keyword harvest function treats all emails equally and only reads the short `body_preview`. This plan adds a dedicated SEO email mining source that extracts structured ranking data from these tool reports.

---

## What We Have

| Source | Emails Found | Body Size | Data Available |
|--------|-------------|-----------|----------------|
| Semrush Position Tracking | 2 emails | ~1KB (HTML rendering issue) | Ranking changes, position updates |
| Semrush Site Audit | 2 emails | 44-54KB rich HTML | Page issues, redirects, crawl errors |
| Wincher | 1 email | 7KB structured text | Top positions reached, ranking drops, competitor data |
| Yoast | 2 emails | Brand analysis, SEO priorities | |

---

## Changes

### 1. New Edge Function: `seo-email-harvest`

A dedicated function that:

- Queries `communications` table for emails from SEMrush, Wincher, Yoast, Ahrefs, Moz (filtering by `from_address`)
- Extracts the full HTML body from `metadata->>'body'`
- Strips HTML tags to get clean text
- Sends the cleaned content to AI (Gemini Flash) with a specialized prompt to extract:
  - **Keywords with ranking positions** (from Position Tracking / Wincher)
  - **SEO issues** (from Site Audit emails)
  - **Ranking changes** (up/down movements with dates)
  - **Competitor mentions**
- Upserts extracted keywords into `seo_keyword_ai` with source tag `seo_tools`
- Upserts SEO issues into `seo_insight` table
- Returns a summary of what was extracted

### 2. Update `seo-keyword-harvest` -- Add SEO Tools Source

Add a new **SOURCE 10: SEO Tool Reports** block that specifically queries communications from known SEO tool senders and includes the full `metadata->>'body'` content (not just `body_preview`). This gives the existing harvest pipeline access to the rich report data.

### 3. Update `SeoOverview.tsx` -- Add "Mine SEO Reports" Button

Add a button next to "Run AI Analysis" that triggers the `seo-email-harvest` function. Show results with a toast indicating how many keywords/issues were extracted from email reports.

### 4. Add `seo_tools` Source Color

Add `seo_tools` to the `SOURCE_COLORS` map so it shows distinctly in the keyword source distribution card.

---

## Technical Details

### Files Created

| File | Purpose |
|------|---------|
| `supabase/functions/seo-email-harvest/index.ts` | Dedicated function to parse SEO tool emails and extract structured data |

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/seo-keyword-harvest/index.ts` | Add SOURCE 10 block for SEO tool report emails with full body content |
| `src/components/seo/SeoOverview.tsx` | Add "Mine SEO Reports" button, add `seo_tools` source color |

### AI Prompt Strategy

The AI prompt will be specialized for SEO tool report parsing:
- Recognize Semrush Position Tracking format (keyword + position + change)
- Recognize Wincher ranking notification format (top positions, drops, competitor data)
- Recognize Semrush Site Audit format (issue types, severity, page URLs)
- Extract concrete keyword-position pairs rather than general themes
- Tag each extraction with the tool source (semrush, wincher, yoast)

### Email Query Filter

```sql
from_address ILIKE '%semrush%'
OR from_address ILIKE '%wincher%'
OR from_address ILIKE '%yoast%'
OR from_address ILIKE '%ahrefs%'
OR from_address ILIKE '%moz.com%'
OR from_address ILIKE '%searchconsole%'
```

Limited to last 90 days, pulling full `metadata->>'body'` for rich content extraction.

