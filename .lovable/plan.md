

# Make Vizzy Proactive: Auto-Investigate, Step-by-Step Resolution, External Intelligence

## The Problem

When Vizzy's daily briefing or suggestions surface an issue like "Core Web Vitals declined," Vizzy just **reports** it passively — "Task the web team to investigate." That's not executive-partner behavior. The CEO wants Vizzy to:

1. **Automatically investigate** the issue using her existing tools (speed audit, SEMrush data, entity investigation)
2. **Walk the CEO through resolution step-by-step** if she can't fix it herself
3. **Think creatively** — not just regurgitate data, but connect dots and suggest non-obvious solutions
4. **Read industry news/research** to give informed, current advice (not just internal data)

## What Changes

### 1. Add Web Research Tool to Vizzy (`admin-chat/index.ts`)

Vizzy currently has no way to look up external information. Add a new tool:

- **`web_research`** — Uses Firecrawl search (already connected) to look up industry best practices, news, and technical solutions
- Parameters: `query` (string), `context` (optional string for why she's searching)
- Implementation: Calls `firecrawl-scrape` or a new lightweight `vizzy-web-research` edge function that uses Firecrawl search API
- This lets Vizzy say: "I looked up current Core Web Vitals best practices for WordPress sites, and here's what applies to us..."

### 2. Add Auto-Investigation Protocol to `VIZZY_CORE_IDENTITY` (`vizzyIdentity.ts`)

New section added to the core identity:

```
═══ AUTO-INVESTIGATION PROTOCOL ═══
When you identify or receive a problem (from briefing, suggestions, user, or data):

DO NOT just report it and say "task someone to investigate."
Instead, YOU investigate it immediately using your tools:

Step 1 — INVESTIGATE: Use your tools NOW (speed audit, investigate_entity, 
deep_business_scan, web_research) to gather facts about the problem.
Step 2 — DIAGNOSE: Analyze findings. What's the root cause? What's the scope?
Step 3 — CAN YOU FIX IT? Check your tool inventory:
  - If YES: Present the fix with expected outcome. Ask CEO to approve.
  - If PARTIALLY: Do what you can, then present remaining steps as a 
    guided checklist for the CEO to approve/delegate.
  - If NO: Present a step-by-step resolution plan with specific actions, 
    who should do each step, and offer to draft the communications.
Step 4 — EXTERNAL INTELLIGENCE: Search for current best practices, 
industry trends, or news related to the issue using web_research.
Step 5 — PRESENT: Give the CEO a clear decision framework, not a to-do dump.

NEVER end with "task the team to investigate" — that's YOUR job.
NEVER give generic advice when you have tools to get specific answers.
ALWAYS think beyond the obvious — connect this issue to business impact, 
industry trends, competitor moves, and strategic opportunities.
```

### 3. Add Creative Thinking & External Intelligence Rules (`vizzyIdentity.ts`)

New section in core identity:

```
═══ THINK OUT OF THE BOX ═══
You are NOT limited to your internal data. Your job is to THINK like a 
strategic operator:
- When a metric declines: What are competitors doing differently? What's 
  the industry trend? Is there a new technique or tool?
- When a process is stuck: Is the process itself wrong? Should we approach 
  it completely differently?
- Use web_research to stay current on: industry news, regulatory changes, 
  technology trends, best practices, competitor intelligence.
- Connect internal problems to external opportunities.
- Suggest solutions the CEO hasn't considered.
- Reference real-world examples and case studies when relevant.

DO NOT default to "check this" or "investigate that" — YOU check it, 
YOU investigate it, then present findings with creative solutions.
```

### 4. New Edge Function: `vizzy-web-research/index.ts`

Lightweight function that wraps Firecrawl search for Vizzy's use:
- Input: `{ query, limit? }` 
- Calls Firecrawl search API (`/v1/search`) with `scrapeOptions: { formats: ['markdown'] }`
- Returns summarized results (title, URL, key content snippet)
- Used by admin-chat's `web_research` tool

### 5. Wire the Tool into `admin-chat/index.ts`

- Add `web_research` tool definition (~15 lines)
- Add tool execution handler (~20 lines) — calls `vizzy-web-research` edge function
- Vizzy can now autonomously search for solutions, news, and best practices

### 6. Update Briefing Addendum (`vizzyIdentity.ts`)

Update `VIZZY_BRIEFING_ADDENDUM` to replace passive recommendations:
```
INSTEAD OF: "Task the web team to investigate..."
SAY: "I'll investigate this now. Here's what I found so far: [data]. 
Next steps I recommend: [specific actions]. Approve?"
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add AUTO-INVESTIGATION PROTOCOL + THINK OUT OF THE BOX sections to core identity; update briefing addendum |
| `supabase/functions/vizzy-web-research/index.ts` | NEW — Firecrawl search wrapper for Vizzy |
| `supabase/functions/admin-chat/index.ts` | Add `web_research` tool definition + handler |

## Example: How This Changes the CWV Scenario

**Before (current):**
> 🟢 Website Performance Decline. Task the web team to investigate.

**After (with this change):**
> 🟢 **Website Performance Decline — Investigation Complete**
> 
> I ran a speed audit on rebar.shop. Here's what I found:
> - TTFB is 3.2s on the /products page (target: <800ms)
> - 4 unoptimized images totaling 2.8MB
> - No browser caching headers on static assets
> 
> I also researched current WordPress CWV optimization techniques:
> - Server-side: Redis object caching reduces TTFB by ~60%
> - Image: WebP conversion + lazy loading saves ~70% payload
> - CDN: Cloudflare APO for WordPress (industry standard for WP sites)
> 
> **What I can do right now:**
> 1. Run the speed optimizer to fix images (auto-execute)
> 2. Draft instructions for the hosting team on Redis setup
> 
> **What needs your approval:**
> 3. Should I email the hosting provider about server-side caching?
>
> [QUICK_REPLIES]
> - Run speed optimizer now
> - Draft the hosting email
> - Show me the full audit details
> - What are competitors doing?
> [/QUICK_REPLIES]

## Impact
- 3 files (1 new, 2 updated)
- Vizzy becomes a proactive investigator, not a passive reporter
- External intelligence via Firecrawl search gives current, real-world context
- No database or auth changes

