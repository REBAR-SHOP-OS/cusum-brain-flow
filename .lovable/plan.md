

## Plan: Smart SEO Scanner — Auto-Detect Sources, Auto-Fix, and Guide

### Problem
The SEO task system creates tasks like "Provide Page Data" that ask the user to manually export data from Google Search Console, even though GSC, Wincher, SEMrush, and site crawl functions are all connected and functional. The AI planner doesn't know about these data sources and can't auto-trigger them.

### What Changes

#### 1. New Edge Function: `seo-smart-scan` 
A master orchestrator that:
- **Auto-detects all connected data sources** (GSC via OAuth, Wincher via API key, SEMrush API, site crawl, link audit, keyword harvest)
- **Runs all available syncs** in parallel (calls existing functions: `seo-gsc-sync`, `wincher-sync`, `semrush-api`, `seo-site-crawl`, `seo-keyword-harvest`, `seo-link-audit`)
- **Feeds aggregated data to `seo-ai-analyze`** for AI-powered analysis
- **Creates tasks with auto-fix flags** — each task gets `can_autofix: true/false` based on whether it's within WP API capabilities
- **Auto-executes fixable tasks** immediately (meta titles, descriptions, JSON-LD, content updates) by calling `seo-task-execute`
- **Non-fixable tasks** get detailed human instructions (DNS changes, plugin installs, GA setup, etc.)
- Returns a summary: `{ sources_synced, issues_found, auto_fixed, manual_required }`

#### 2. Update `seo-ai-analyze` System Prompt
- Remove any prompts that generate "provide data" type tasks
- Add instruction: "Never create tasks asking the user to provide data — the system automatically pulls from GSC, Wincher, SEMrush, and site crawl"
- Add `can_autofix` boolean to the task schema so AI labels each task

#### 3. Update `seo-task-execute` — Add More Auto-Actions
Add these to `ALLOWED_ACTIONS` and the system prompt:
- `trigger_wincher_sync` — calls `wincher-sync`
- `trigger_semrush_sync` — calls `semrush-api` with `action: "domain_overview"`
- `trigger_site_crawl` — calls `seo-site-crawl`
- `trigger_link_audit` — calls `seo-link-audit` with `phase: "crawl"`

#### 4. Update `SeoTasks.tsx` UI
- Add "Smart Scan" button at top that triggers `seo-smart-scan`
- Show scan progress and results summary
- Auto-fixed tasks show green "AI Fixed" badge
- Manual tasks show clear step-by-step instructions with a yellow "Manual" badge
- Group tasks by: "Auto-Fixed" | "Needs Your Action" | "Open"

### Technical Details

**`seo-smart-scan` flow:**
```text
1. Check available sources:
   - GSC: user_gmail_tokens exists? → call seo-gsc-sync
   - Wincher: WINCHER_API_KEY set? → call wincher-sync
   - SEMrush: hardcoded key exists → call semrush-api
   - Site crawl: always available → call seo-site-crawl
   - Link audit: always available → call seo-link-audit (crawl phase)
   - Keyword harvest: always available → call seo-keyword-harvest

2. Run all available syncs in parallel (Promise.allSettled)

3. Call seo-ai-analyze with refreshed data

4. For each new task with can_autofix=true:
   → call seo-task-execute (analyze + execute) immediately
   
5. Return summary to frontend
```

**Files to create:**
- `supabase/functions/seo-smart-scan/index.ts`

**Files to modify:**
- `supabase/functions/seo-ai-analyze/index.ts` — update AI prompt, add `can_autofix` to task schema
- `supabase/functions/seo-task-execute/index.ts` — add Wincher/SEMrush/crawl sync actions
- `src/components/seo/SeoTasks.tsx` — add Smart Scan button and improved UI grouping

### Result
One-click "Smart Scan" automatically pulls data from all connected sources, identifies all SEO issues, auto-fixes everything possible via WordPress API, and presents clear manual instructions for the rest.

