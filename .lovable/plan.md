
# Fix Odoo Integration Status — Show as Connected

## Problem
The Odoo card shows "Connect" even though all 4 Odoo secrets (`ODOO_URL`, `ODOO_DATABASE`, `ODOO_USERNAME`, `ODOO_API_KEY`) are already configured. This happens because:
1. `checkAllStatuses` in `useIntegrations.ts` has no Odoo check
2. No row exists in the `integration_connections` table for Odoo

## Solution
Add an Odoo status check to `checkAllStatuses` in `src/hooks/useIntegrations.ts` that calls one of the existing Odoo sync functions (e.g., `sync-odoo-leads`) with a lightweight "check-status" action, or simply attempts a test connection to verify the secrets work. If the secrets are valid, mark the card as "connected".

### Option chosen: Direct environment check via a new action
Since the Odoo sync functions don't have a `check-status` action yet, the simplest approach is to add a quick Odoo connectivity test inside `checkAllStatuses`:
- Call `sync-odoo-leads` with a `{ action: "check-status" }` body
- Add a handler in `sync-odoo-leads/index.ts` that checks if all 4 env vars are set and optionally pings the Odoo server
- On success, update the integration status to "connected" and upsert an `integration_connections` row

### Files to modify
- **`supabase/functions/sync-odoo-leads/index.ts`** -- Add a `check-status` action that verifies env vars are set and returns `{ status: "connected" }`
- **`src/hooks/useIntegrations.ts`** -- Add an Odoo block in `checkAllStatuses` that invokes `sync-odoo-leads` with `check-status` and updates the card state
