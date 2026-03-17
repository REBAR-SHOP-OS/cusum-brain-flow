

## Production Patch: Odoo Mirror Pipeline + Sales Department

### Current State Assessment

**Already done (no work needed):**
- Sales Department sidebar section with 4 icons ✅
- Routes: `/sales/pipeline`, `/sales/quotations`, `/sales/invoices`, `/sales/contacts` ✅
- Database tables: `sales_leads`, `sales_contacts`, `sales_invoices`, `sales_quotations` ✅
- Sales Pipeline page with drag/drop, create, edit, stages (New → Won/Lost) ✅
- Quotations, Invoices, Contacts pages with CRUD ✅
- `useSalesLeads` hook with realtime subscription ✅
- Old pipeline at `/pipeline` with full Odoo stage set ✅
- `OdooChatter` with unified timeline (activities, comms, files, events, date sorting) ✅
- `odoo-crm-sync` and `odoo-chatter-sync` edge functions ✅
- LeadDetailDrawer with Odoo-style UI ✅

**What actually needs to be built:**

### PART 1 — On-Open Lead Refresh from Odoo

When a user opens a lead in the old pipeline, trigger a targeted refresh for that specific lead.

**File: `src/components/pipeline/LeadDetailDrawer.tsx`**
- Add a `useEffect` that fires when the drawer opens (`open === true && lead?.id`)
- Call `supabase.functions.invoke("odoo-chatter-sync", { body: { mode: "single", odoo_id } })` to pull latest chatter/activities/files for just that lead
- Show a small "Refreshing from Odoo..." indicator during fetch
- Invalidate the relevant query keys (`lead-activities`, `lead-files-timeline`, `lead-events`, `lead-communications-chatter`) after the refresh completes
- Also call a targeted single-lead refresh via `odoo-crm-sync` for field updates (stage, revenue, probability)

**File: `supabase/functions/odoo-crm-sync/index.ts`**
- Add a `mode: "single"` path that accepts an `odoo_id` parameter
- Fetches just that one lead from Odoo and updates the local record (stage, fields, metadata)
- Returns the updated data

**File: `supabase/functions/odoo-chatter-sync/index.ts`**
- The `mode: "single"` path already exists — verify it works correctly and returns a success indicator

### PART 2 — Sync Freshness Indicator

**File: `src/components/pipeline/LeadDetailDrawer.tsx`**
- Show "Last synced: X minutes ago" in the footer using `lead.metadata.synced_at`
- Show sync status: a green dot for recent (<5min), yellow for stale (>30min), red for errors

### PART 3 — Odoo Delete/Archive Reconciliation

**File: `supabase/functions/odoo-crm-sync/index.ts`**
- After syncing all active leads, compare local `odoo_sync` leads against the fetched set
- Leads present locally but missing from Odoo → mark as `archived_orphan` stage
- Already partially implemented (the function fetches all existing leads for dedup) — add the reconciliation step at the end

### PART 4 — Unified Timeline Improvements

The OdooChatter component (1172 lines) already implements a unified timeline with:
- Activities, communications, files, lead events
- File-to-message linking via `odoo_message_id`
- Date separators
- Visual distinction by type
- Noise suppression

**Enhancements needed:**
- **File: `src/components/pipeline/OdooChatter.tsx`**
  - Add date separator headers ("Today", "Yesterday", "March 13, 2026")
  - Ensure unlinked Odoo files show under a labeled "Unlinked Files" section (partially done, improve labeling)

### Summary of Changes

```text
Files to modify:
├── src/components/pipeline/LeadDetailDrawer.tsx  (on-open refresh + sync indicator)
├── src/components/pipeline/OdooChatter.tsx       (date separators in timeline)
├── supabase/functions/odoo-crm-sync/index.ts     (single-lead refresh mode + archive reconciliation)
└── supabase/functions/odoo-chatter-sync/index.ts  (verify single mode, minor fixes)

No new tables needed.
No new routes needed.
No sidebar changes needed.
No new pages needed.
```

### Priority Order
1. Single-lead refresh on open (biggest trust impact)
2. Archive/delete reconciliation in sync
3. Date separators in timeline
4. Sync freshness indicator

### Risks
- Odoo API rate limits if many leads opened rapidly — mitigate with a 30-second cooldown per lead
- Single-lead sync adds ~1-2s latency on drawer open — mitigate with optimistic rendering + background refresh

