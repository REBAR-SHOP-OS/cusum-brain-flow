

## QA War Engine — Already Built and Ready

The entire QA War Engine you described is **already implemented** in this project. Here is what exists:

### Edge Function: `supabase/functions/qa-war-engine/index.ts`
- Runs 20 batches of 25 scenarios each (500 total)
- Uses Gemini 2.5 Pro to generate structured bug reports against the live database schema
- Distribution matches your spec: normal flows, edge cases, concurrency, permission abuse, integration failures, corrupt data, extreme stress
- Deduplicates bugs using a hash of module + title
- Detects regressions (bugs previously marked "fixed" that reappear)
- Computes a technical debt score
- Produces summary with breakdowns by severity, module, type, and category
- Admin-only access enforced via `user_roles` check

### Frontend: `src/pages/QaWar.tsx` (route: `/qa-war`)
- "Launch QA War" button triggers the 500-scenario simulation
- Run history with status badges and bug counts
- Summary dashboard: total bugs, critical count (S0+S1), debt score, top risk modules
- Filterable bug registry table (severity, module, category)
- Hover-to-reveal root cause and fix proposal per bug
- JSON export of filtered results

### Database: `qa_war_runs` + `qa_war_bugs` tables
- Persists all runs and bugs with company_id scoping

### No changes needed
Navigate to `/qa-war` and click **Launch QA War** to execute the full 500-scenario stress simulation. It takes approximately 3 minutes to complete all 20 batches.

