

# Direct Odoo CRM Sync via JSON-RPC API

## Overview

Instead of parsing OdooBot emails (which only captures partial data), we'll connect directly to **crm.rebar.shop** using the Odoo JSON-RPC API to pull the complete CRM pipeline -- all leads, contacts, stages, probabilities, expected values, deadlines, and assignees.

Your Odoo credentials are already stored securely (ODOO_URL, ODOO_USERNAME, ODOO_API_KEY, ODOO_DATABASE).

## What Gets Pulled

From Odoo's `crm.lead` model:
- Lead/opportunity name, stage, probability, expected revenue
- Contact name, email, phone, company
- Assigned salesperson
- Deadline / expected close date
- Notes and tags
- Create and update timestamps

## How It Works

```text
Pipeline Page
    |
    +--[ Sync Odoo ] button click
    |
    v
sync-odoo-leads edge function (upgraded)
    |
    +-- 1. Authenticate via JSON-RPC to crm.rebar.shop
    +-- 2. Fetch all crm.lead records (search_read)
    +-- 3. Fetch crm.stage records for stage name mapping
    +-- 4. For each Odoo lead:
    |       - Map Odoo stage name to pipeline stage
    |       - Find or create customer record
    |       - Find or create contact record
    |       - Deduplicate against existing leads
    |       - Create or update lead
    +-- 5. Return sync results summary
```

## Changes

### 1. Upgrade `sync-odoo-leads` Edge Function

Replace the OdooBot email parser with a direct Odoo JSON-RPC client:

- **Authenticate** via `POST /web/session/authenticate` using stored secrets
- **Fetch stages** via `POST /web/dataset/call_kw` on `crm.stage` model (`search_read`)
- **Fetch all leads** via `search_read` on `crm.lead` model with fields:
  - `name`, `stage_id`, `partner_id`, `contact_name`, `email_from`, `phone`, `mobile`
  - `expected_revenue`, `probability`, `date_deadline`, `user_id`, `description`
  - `create_date`, `write_date`, `tag_ids`, `priority`
- **Map stages**: Build a lookup from Odoo stage IDs to local pipeline stage slugs using the existing `ODOO_STAGE_MAP`
- **Upsert logic**:
  - Match existing leads by `source_email_id` pattern `odoo_crm_{odoo_lead_id}` (unique per Odoo record)
  - If found: update stage, probability, expected value, deadline
  - If new: create lead + customer + contact records
- **Safety**: All leads tagged `source: "odoo_sync"`, never overwrites manually-edited leads

### 2. Pipeline UI -- No Changes Needed

The existing "Sync Odoo" button and source badges already work. The button calls the same `sync-odoo-leads` function, so no UI changes required.

### 3. Config -- No Changes Needed

The function is already in `config.toml` with `verify_jwt = false`.

## Technical Details

### Odoo JSON-RPC Call Pattern

```text
POST https://crm.rebar.shop/web/session/authenticate
Body: { jsonrpc: "2.0", params: { db, login, password } }
Response: Sets session cookie

POST https://crm.rebar.shop/web/dataset/call_kw
Body: {
  jsonrpc: "2.0",
  params: {
    model: "crm.lead",
    method: "search_read",
    args: [[]],              // empty domain = all records
    kwargs: {
      fields: ["name", "stage_id", "partner_id", ...],
      limit: 1000
    }
  }
}
```

### Deduplication Strategy

Each Odoo lead has a unique numeric ID. We store it as `source_email_id: "odoo_crm_{id}"` in the leads table. On re-sync:
- Existing leads get stage/probability/value **updated**
- New leads get **created** with customer and contact records
- Manually created leads (no `odoo_crm_` prefix) are never touched

### Stage Mapping

Uses the existing `ODOO_STAGE_MAP` dictionary. Odoo's `stage_id` returns `[id, "Stage Name"]` -- we match the name string against the map.

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/sync-odoo-leads/index.ts` | Replace email parser with direct JSON-RPC client; keep all existing dedup/mapping logic |

One file change only. Everything else (UI, config, stage mapping) already exists.

