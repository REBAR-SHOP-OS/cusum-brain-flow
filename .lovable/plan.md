
# Re-establish Odoo CRM Pipeline Sync

## Problem
The Odoo CRM sync function was previously removed from the codebase (comment says "Odoo has been decommissioned"), but the database still holds 2,700+ leads with `source: odoo_sync` and rich metadata (`odoo_id`, `odoo_stage`, `odoo_salesperson`, etc.). The last sync was around Feb 10, 2026. You need this sync restored.

## Solution
Create a new `odoo-crm-sync` edge function that pulls `crm.lead` records from Odoo via JSON-RPC (using the same Bearer token auth pattern proven in `odoo-file-proxy`) and upserts them into the `leads` table.

## Stage Mapping (Odoo -> ERP)
Based on existing synced data:

| Odoo Stage | ERP Stage |
|---|---|
| New | new |
| Telephonic Enquiries | telephonic_enquiries |
| Qualified | qualified |
| RFI | rfi |
| Addendums | addendums |
| Estimation-Ben | estimation_ben |
| Estimation-Karthick(Mavericks) | estimation_karthick |
| QC - Ben | qc_ben |
| Hot Enquiries | hot_enquiries |
| Quotation Priority | quotation_priority |
| Quotation Bids | quotation_bids |
| Shop Drawing | shop_drawing |
| Shop Drawing Sent for Approval | shop_drawing_approval |
| Fabrication In Shop | shop_drawing |
| Delivered/Pickup Done | won |
| Ready To Dispatch/Pickup | won |
| Won | won |
| Loss | lost |
| Merged | lost |
| No rebars(Our of Scope) | lost |

## Technical Details

### 1. New Edge Function: `supabase/functions/odoo-crm-sync/index.ts`
- Uses `requireAuth` from shared auth module (admin-only access)
- Authenticates to Odoo via JSON-RPC with `Bearer ${ODOO_API_KEY}` (proven pattern)
- Calls `execute_kw` on `crm.lead` model to fetch all opportunities
- Fields fetched: `id`, `name`, `stage_id`, `email_from`, `phone`, `contact_name`, `user_id` (salesperson), `probability`, `expected_revenue`, `type`, `partner_name`
- Upserts into `leads` table using `metadata->>'odoo_id'` as the dedup key
- For existing leads (matched by `odoo_id`), updates stage, probability, revenue, contact info, and sets `synced_at`
- For new leads, creates customer record if needed, then inserts the lead
- Returns stats: `{ created, updated, skipped, errors }`

### 2. Config: `supabase/config.toml`
- Add `[functions.odoo-crm-sync]` with `verify_jwt = false`

### 3. Pipeline Page: Add Sync Button
- Add an "Odoo Sync" button next to the existing "Scan RFQ" button in `src/pages/Pipeline.tsx`
- Calls the `odoo-crm-sync` edge function
- Shows toast with sync results

### 4. Fix `pipeline-ai/index.ts`
- Remove the "Odoo has been decommissioned" comment
- Restore awareness that pipeline data includes Odoo-synced leads

### Secrets Required
All Odoo secrets already exist: `ODOO_URL`, `ODOO_API_KEY`, `ODOO_USERNAME`, `ODOO_DATABASE`

### No Database Changes Needed
The `leads` table already has all required columns including `metadata` (jsonb) for storing Odoo-specific fields.
