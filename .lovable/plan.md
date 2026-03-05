

# Fix: Missing Leads — Odoo Sync Data Gap

## Problem

The database has **1 lead** in `qc_ben` stage but Odoo shows **2**. The missing lead is "FW: 3 Kingsbury Crescent" by Walden Homes. This is not a UI bug — the data was never synced or was lost during dedup.

This likely affects **all columns**, not just QC-Ben. The sync may have missed leads due to:
1. **Incremental mode** — the default sync only fetches leads modified in the last 5 days. If a lead hasn't been touched recently, it won't sync.
2. **Dedup logic** — the dedup process may have incorrectly deleted leads during `odoo_id` map building.
3. **Customer resolution failure** — if customer name matching fails (line 298: `errors++; continue;`), the lead is silently skipped.

## Solution

### Step 1: Run a Full Sync

The existing `odoo-crm-sync` function already supports `{ "mode": "full" }` which fetches ALL opportunities from Odoo without the 5-day `write_date` filter. This should recover any missing leads.

I will trigger the full sync via the edge function.

### Step 2: Verify Counts Match

After the full sync, I'll query the database and compare lead counts per stage against what Odoo reports.

### Step 3: Fix Silent Failures (Code Change)

The sync function has a critical bug on **line 298-300**: when customer resolution fails for active-stage leads, it silently increments `errors++` and `continue`s — **skipping the entire lead**. This means leads with unresolvable customer names are permanently lost from sync.

**Fix**: Instead of skipping, insert the lead with `customer_id = null` and log a warning. The lead data is more important than the customer linkage.

| File | Change |
|------|--------|
| `supabase/functions/odoo-crm-sync/index.ts` | Remove `continue` on customer resolution failure — insert lead with null customer_id instead of skipping |

### No UI Changes Needed

The pipeline board correctly displays whatever is in the database. The gap is purely in the sync layer.

