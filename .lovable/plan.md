

# Pipeline Unified Timeline & Data Quality Patch

## Current State Analysis

The pipeline already has a sophisticated `OdooChatter` component (1172 lines) that merges `lead_activities`, `lead_files`, `lead_events`, and `lead_communications` into a unified thread with date separators, file attachment linking via `odoo_message_id`, and thread filtering (All/Conversation/Audit). However, several critical issues exist:

**Data issues found:**
- **14,763 lead_files exist — zero are linked to messages** (`odoo_message_id` is NULL on all). The chatter sync does attempt linkage (line 282-293) but it's matching `attachment_ids` against `odoo_id` in `lead_files`, and the files aren't being populated with matching IDs.
- **582/2902 leads have priority "low"** — Odoo maps `priority=0` to "low" but Odoo's "0" means "normal", not low.
- **679/2902 leads have zero expected_value** — many are in revenue-expected stages like `quotation_bids` (679 leads).
- **739 leads have zero probability** — includes active stages that should have probability from Odoo ML.

**UI issues:**
- Lead detail drawer has 4 separate tabs (chatter/activities/files/notes) — fragments the experience.
- OdooChatter already does unified timeline but files never appear inline because `odoo_message_id` linkage is broken.
- Pipeline board shows all 29 stages in one horizontal scroll — very wide.

---

## Phase 1: Fix File-to-Message Linkage (Backend — Critical)

### Problem
`odoo-chatter-sync` links files by matching `msg.attachment_ids` (Odoo attachment IDs) against `lead_files.odoo_id`. But `lead_files.odoo_id` stores the Odoo `ir.attachment` ID. The matching logic looks correct in principle — the issue is likely that files are synced by a different function (`odoo-crm-sync` imports files separately) and the `odoo_id` values don't align with `attachment_ids` returned by `mail.message`.

### Fix in `supabase/functions/odoo-chatter-sync/index.ts`
**Lines 282-293**: The linkage loop runs `.in("odoo_id", msg.attachment_ids)` — this should work if `odoo_id` on `lead_files` matches Odoo's `ir.attachment` IDs. Add diagnostic logging and a dedicated repair pass:

1. After the main message sync loop, add a **repair pass** that:
   - Fetches all `lead_files` with `odoo_id IS NOT NULL AND odoo_message_id IS NULL` for the current batch of leads
   - For each file's `odoo_id`, queries Odoo `ir.attachment.read([odoo_id], {fields: ["res_id", "res_model"]})` to find which `crm.lead` it belongs to
   - Then queries `mail.message` for that lead to find which message references this attachment
   - Updates `lead_files.odoo_message_id` accordingly
   - Also sets `created_at` from the parent message's date

2. Add better error logging in the existing linkage to understand why 14,763 files remain unlinked.

### Migration: Add index for faster lookups
```sql
CREATE INDEX IF NOT EXISTS idx_lead_files_odoo_id_msg ON lead_files(odoo_id) WHERE odoo_message_id IS NULL;
```

---

## Phase 2: Fix Priority & Value Mapping (Backend)

### Priority fix in `supabase/functions/odoo-crm-sync/index.ts`
**Line 470**: Currently maps `ol.priority === "3" → "high", "2" → "medium", else → "low"`.

Odoo priority values: `0`=Normal, `1`=Low priority, `2`=High, `3`=Very High. Fix:
```
"0" → "medium" (normal)
"1" → "low"  
"2" → "high"
"3" → "high"
```

### Expected value fix
**Line 376/463**: Uses `Number(ol.expected_revenue) || 0`. The `|| 0` masks Odoo fields that might be `false` or `""`. 

Also check if Odoo's `planned_revenue` field should be used as fallback when `expected_revenue` is 0. Add to FIELDS array:
```
"planned_revenue"
```

Then: `Number(ol.expected_revenue) || Number(ol.planned_revenue) || 0`

### Probability fix
**Line 277**: `Math.round(Number(ol.probability) || 0)` — Odoo returns probability as float (e.g., 10.0). This mapping is correct but terminal stage override may clobber valid values. Keep as-is, just ensure we don't override non-zero probability with 0 on update.

---

## Phase 3: Unify Lead Detail Drawer (Frontend — Main UX Change)

### `src/components/pipeline/LeadDetailDrawer.tsx`
Replace the 4-tab layout with a **2-tab layout**:

1. **"Timeline"** (default) — renders `OdooChatter` which already has the unified timeline with All/Conversation/Audit sub-filters
2. **"Details"** — combines current Notes tab + any extra metadata

Remove the separate "activities" and "files" tabs since OdooChatter already includes both in its unified feed. The `ScheduledActivities` component is also already rendered inside OdooChatter as "Planned Activities".

### Changes:
- Line 79: Change `activeTab` state to `"timeline" | "details"` with default `"timeline"`
- Lines 361-378: Replace 4-tab buttons with 2 tabs
- Lines 407-421: Timeline renders OdooChatter, Details renders notes + description

This is a minimal change (~20 lines modified) that dramatically improves the experience.

---

## Phase 4: Pipeline Board Usability (Frontend — Low Risk)

### `src/components/pipeline/PipelineColumn.tsx` / `PipelineBoard.tsx`
- Reduce column min-width from whatever it is now to make columns more compact
- Add stage group headers or collapsible sections:
  - **Sales**: prospecting, new, telephonic_enquiries, qualified, hot_enquiries, rfi, addendums
  - **Estimation**: estimation_*, qc_ben
  - **Quotation**: quotation_priority, quotation_bids
  - **Operations**: shop_drawing*, fabrication_in_shop, ready_to_dispatch, out_for_delivery, delivered_pickup_done
  - **Terminal**: won, lost, loss, merged, archived_orphan, no_rebars_out_of_scope, dreamers, temp_ir_vam, migration_others

### `src/pages/Pipeline.tsx`
Add a stage group filter in `PipelineFilters` that lets users toggle which groups are visible. Default: show Sales + Estimation + Quotation (hide terminal stages).

This addresses the "too wide" complaint without changing the board fundamentally.

---

## Phase 5: Lead Visibility Audit (Backend)

### Investigation areas:
1. **Stage mapping gaps**: Check if any Odoo stage names don't match `STAGE_MAP` keys — unmapped stages fall to `"new"` which may hide leads in the wrong column
2. **TERMINAL_STAGES filter**: The Pipeline page fetches ALL leads without filtering by stage, so terminal leads are visible. But the `ACTIVE_STAGES` set used for customer resolution may skip leads.
3. **Source filtering**: No source filter exists in the query (line 209-213 of Pipeline.tsx fetches all leads). This is correct.

### Fix:
- Add `"Lost"` → `"lost"` to STAGE_MAP (currently only `"Loss"` is mapped)
- Add `"Prospecting"` → `"prospecting"` if Odoo uses that label
- Add logging in `odoo-crm-sync` for any unrecognized stage names that fall through to default

---

## Summary of Files Changed

| File | Type | Change |
|------|------|--------|
| `supabase/functions/odoo-chatter-sync/index.ts` | Backend | Add file linkage repair pass |
| `supabase/functions/odoo-crm-sync/index.ts` | Backend | Fix priority mapping, add planned_revenue fallback |
| `supabase/functions/_shared/odoo-validation.ts` | Backend | Add missing stage mappings |
| `src/components/pipeline/LeadDetailDrawer.tsx` | Frontend | Consolidate to 2 tabs (Timeline/Details) |
| `src/components/pipeline/PipelineFilters.tsx` | Frontend | Add stage group filter |
| `src/pages/Pipeline.tsx` | Frontend | Wire stage group filtering |
| Migration SQL | Schema | Add index on lead_files for repair query |

### Known Risks
- File linkage repair makes additional Odoo API calls (rate limits) — process in small batches
- Priority re-mapping will change existing lead priorities on next sync — this is intentional and correct
- Removing tabs is low risk since OdooChatter already contains all the data

### Follow-up Needed
- Monitor file linkage repair results after deployment
- May need a one-time data fix migration to update existing priority values without waiting for next Odoo sync
- Consider adding a "Files" count badge on the Timeline tab to indicate attachment presence

