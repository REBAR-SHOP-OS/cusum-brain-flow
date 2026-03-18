

## Smarter Broken Link Fix: Find Real Replacement Links

### Problem
Currently, `generateBrokenLinkProposal` only offers 3 actions: **remove** (keep text, drop link), **archive** (Wayback Machine), or **unlink** (remove everything). When no archive exists, it defaults to removing the link — wasting an SEO opportunity.

### Solution
Add a **web search step** using Firecrawl's search API before the AI decides. Search for the topic of the broken link to find a real, live replacement URL. Then add a 4th action: **"replace"** — swap the broken href with a relevant, working URL.

### Plan

**File: `supabase/functions/seo-link-audit/index.ts`** — `generateBrokenLinkProposal` function (lines 346-401)

1. **Add web search before AI call**: Use Firecrawl search API to find relevant replacement URLs based on the anchor text and page context:
   ```text
   anchor_text = "TYPE-4" + page context → search "TYPE-4 rebar specifications"
   → Returns real URLs like "https://www.steelrebarcanada.com/type-4-rebar"
   ```

2. **Add "replace" action** to the AI prompt: Give the AI the search results as candidate replacement URLs. Add a 4th option:
   - `"replace"` — Replace the broken href with the best matching search result URL

3. **Update priority order**:
   - Prefer **"replace"** if a relevant search result exists
   - Then **"archive"** if Wayback exists
   - Then **"remove"** (keep text)
   - **"unlink"** only for spam

4. **Update the fix phase** (lines 433+) to handle the new `"replace"` action — same as archive but uses the search-found URL.

**File: `src/components/seo/SeoLinks.tsx`** — Update the preview dialog to show the replacement URL and label it as "Broken Link Fix (replace)" with the new URL visible.

### Technical Detail

```text
Before:
  broken link "TYPE-4" → no archive → AI says "remove" → text stays, link gone

After:
  broken link "TYPE-4" → Firecrawl search "TYPE-4 rebar" → finds 3 candidates
  → AI picks best match → "replace" with real URL → link stays with working href
```

The search query will be constructed from: `{anchor_text} {domain industry context}` to maximize relevance.

