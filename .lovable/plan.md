

## Plan: Fix Odoo Sync & Pipeline Auto-Refresh

### Issue 1: Odoo Sync Blocked
The `ODOO_ENABLED` secret is missing. The `odoo-crm-sync` and `odoo-chatter-sync` edge functions check `Deno.env.get("ODOO_ENABLED") !== "true"` and exit immediately when it's not set. Need to add `ODOO_ENABLED = true`.

### Issue 2: Pipeline UI Not Auto-Refreshing
The main Pipeline page does not call `usePipelineRealtime()`, so changes to leads don't reflect until manual page refresh. Also, the realtime hook doesn't invalidate the `["leads"]` query key used by the main board.

### Changes

**1. Add `ODOO_ENABLED` secret** — set to `true`

**2. `src/hooks/usePipelineRealtime.ts`**
- Add `queryClient.invalidateQueries({ queryKey: ["leads"] })` to both UPDATE and INSERT handlers

**3. `src/pages/Pipeline.tsx`**
- Import and call `usePipelineRealtime()` at the top of the component

