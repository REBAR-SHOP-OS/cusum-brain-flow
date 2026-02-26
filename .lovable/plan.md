

## Plan: Fix Odoo Sync & Auto-Refresh Pipeline UI

### Two Issues

**Issue 1: Odoo Sync Not Working**
The `odoo-crm-sync` edge function has a feature flag guard at line 74: `if (Deno.env.get("ODOO_ENABLED") !== "true")` — it returns immediately with `{ disabled: true }`. The `ODOO_ENABLED` secret is not set (not in the secrets list). Need to add it.

**Issue 2: Pipeline UI Not Auto-Refreshing**
The Pipeline page (`src/pages/Pipeline.tsx`) does not use `usePipelineRealtime()` — only the Intelligence sub-page does. When leads change in the database, the Pipeline board doesn't update until manual refresh.

### Changes

**1. Add `ODOO_ENABLED` secret**
- Set `ODOO_ENABLED` = `true` so the edge function stops short-circuiting

**2. Add realtime subscription to Pipeline page (`src/pages/Pipeline.tsx`)**
- Import and call `usePipelineRealtime()` at the top of the component
- This will auto-invalidate `["pipeline-intelligence-leads"]` and `["pipeline-leads"]` queries on changes
- Also need to add `["leads"]` invalidation to `usePipelineRealtime.ts` since Pipeline uses `queryKey: ["leads"]`

**3. Update `usePipelineRealtime.ts` to also invalidate the `["leads"]` query key**
- Add `queryClient.invalidateQueries({ queryKey: ["leads"] })` to both UPDATE and INSERT handlers so the main Pipeline board refreshes too

### Files
- `src/pages/Pipeline.tsx` — add `usePipelineRealtime()` call
- `src/hooks/usePipelineRealtime.ts` — add `["leads"]` query invalidation
- Secret: add `ODOO_ENABLED` = `true`

