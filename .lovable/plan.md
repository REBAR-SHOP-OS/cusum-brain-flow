

## Analysis: Is the Fix Real?

**Yes, the fix IS real** — it actually modifies your WordPress pages via the WP REST API. But there are two serious problems:

### Problem 1: Broken Links — Fix Does Nothing
For **broken links**, clicking "Fix" only marks `is_fixed = true` in the database. It does NOT actually fix the broken link on your WordPress site. It's a fake fix.

### Problem 2: Opportunities — Fix Is Dumb, Not Intelligent
For **RSIC opportunities**, the fix works but is primitive:
- It finds the first keyword match via `indexOf`
- Injects the link after the nearest period (`.`)
- No AI reasoning about whether the placement makes sense contextually
- Could insert a link mid-sentence in an awkward spot

---

## Plan: Make Fixes Intelligent with AI

### 1. Broken Link Fix — AI-Powered Resolution (`seo-link-audit/index.ts`)

For broken links, use AI (Gemini) to:
- Analyze the surrounding HTML context of the broken link
- Decide the best action: **remove link** (keep text), **replace with archived version** (Wayback Machine lookup), or **suggest alternative URL**
- Apply the fix to WordPress automatically

### 2. Opportunity Fix — AI-Powered Placement (`seo-link-audit/index.ts`)

Replace the dumb `indexOf + period` logic with AI:
- Send the page content + suggested link to Gemini
- Ask AI to return the exact HTML with the link naturally woven into the most relevant paragraph
- AI considers readability, context relevance, and SEO best practices for placement

### 3. Preview Before Fix (`SeoLinks.tsx`)

Add a confirmation dialog showing:
- **What will change**: Before/after preview of the affected paragraph
- **AI reasoning**: Why this placement/action was chosen
- **Approve/Reject** per fix before applying to WordPress

### Technical Approach

**Edge function changes** (`seo-link-audit/index.ts`):
- Add `phase: "preview"` that returns AI-generated fix proposals without applying them
- Modify `phase: "fix"` to use AI for both broken links and opportunities
- Use Gemini 2.5 Flash for speed (processing up to 60 fixes)
- For broken links: attempt Wayback Machine API lookup, then AI decides best action

**UI changes** (`SeoLinks.tsx`):
- "Fix" button opens a preview dialog with AI's proposed change
- "Fix All" shows a summary dialog with all proposed changes
- User approves before any WordPress modification happens

### Files Changed
- `supabase/functions/seo-link-audit/index.ts` — Add AI-powered fix logic + preview phase
- `src/components/seo/SeoLinks.tsx` — Add preview/confirm dialog before applying fixes

