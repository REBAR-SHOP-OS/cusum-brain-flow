

# Fix: ERP Pipeline Count Must Match Odoo Exactly

## Problem
ERP shows 6 leads in "New" stage while Odoo shows 3. Three root causes:

1. **Stale sync window**: The `odoo-crm-sync` function only fetches leads modified in the last 5 days. Leads that changed stages outside that window remain stuck in their old ERP stage.
2. **Email-scanned leads**: 2 leads (Torpave Group, Cadeploy) were created by the RFQ email scanner and exist only in ERP, inflating the count.
3. **Missing Odoo leads**: At least 1 lead (MVH Metals) exists in Odoo but not in ERP, likely created after the last sync or outside the 5-day window.

## Fix 1: Full Sync Mode for `odoo-crm-sync`

**File**: `supabase/functions/odoo-crm-sync/index.ts`

Change the sync to support two modes:
- **Incremental** (current default): Last 5 days, for routine syncs
- **Full**: No date filter, fetches ALL opportunities from Odoo. This ensures every lead's stage is current.

Add a query parameter `?mode=full` that removes the `write_date` filter. The Pipeline header "Odoo Sync" menu item will trigger a full sync.

Technical change:
- Line 98-100: Read `mode` from request body/params
- If `mode === "full"`, remove the `write_date` filter from the Odoo RPC call
- Default remains incremental for scheduled/routine syncs

## Fix 2: Reconcile Stages for ALL Odoo Leads

After fetching from Odoo, the sync currently only updates leads it fetched. Leads NOT in the fetch result (because they weren't modified recently) keep their stale ERP stage.

Add a reconciliation step: after the main sync loop, for any ERP lead with `source = 'odoo_sync'` whose `odoo_id` was NOT in the fetched batch, perform a targeted Odoo lookup to verify its current stage. If the stage changed, update it.

This ensures "English" and "amigun Aanuoluwapo" get moved out of "New" if Odoo moved them.

## Fix 3: Distinguish Email-Sourced Leads

Email-scanned leads (Torpave, Cadeploy) legitimately exist only in ERP. Two options:

**Option A (recommended)**: Keep them in ERP pipeline but tag them visually so users know they're ERP-only (not from Odoo). Add a small indicator on cards for leads where `source` starts with "Email:".

**Option B**: Auto-push email-sourced leads to Odoo via API so they appear in both systems.

Recommending **Option A** for now -- it's faster and doesn't require Odoo write access.

## Fix 4: Update Pipeline.tsx Sync Button

**File**: `src/pages/Pipeline.tsx`

Change the "Odoo Sync" menu item to trigger a full sync (`mode: "full"`) so every manual sync guarantees exact parity.

```
const { data, error } = await supabase.functions.invoke("odoo-crm-sync", {
  body: { mode: "full" }
});
```

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/odoo-crm-sync/index.ts` | Add full sync mode, add stale lead reconciliation step |
| `src/pages/Pipeline.tsx` | Pass `mode: "full"` to sync invocation |
| `src/components/pipeline/LeadCard.tsx` | (Optional) Add small "email" indicator for non-Odoo leads |

After these changes, running "Odoo Sync" from the pipeline will pull ALL Odoo opportunities, update every stage to match, and the counts will be identical. The 2 email-sourced leads will still appear (they're real leads) but will be distinguishable.

