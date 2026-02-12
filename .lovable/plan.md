
# API Connections Audit Dashboard

## Overview
Build a dedicated **Connections Audit** page at `/admin/connections-audit` that gives a one-glance view of every external integration's health. Instead of navigating to the Integrations page and clicking "Refresh," this page runs all health checks in parallel and presents a structured audit report with clear status badges, data freshness timestamps, and actionable recommendations.

## What you'll see

A single-page audit dashboard with:
- **Summary bar** at the top: X connected, Y degraded, Z disconnected
- **Audit table** with one row per integration showing:
  - Integration name + icon
  - Auth status (connected / degraded / disconnected / not configured)
  - Data freshness (last sync timestamp from `integration_connections`)
  - Health check result (live ping result)
  - Risk level (healthy / warning / critical)
  - Action button (Test / Reconnect / Configure)
- **Auto-run on mount**: all health checks fire in parallel when the page loads
- **Manual re-audit button** to re-run all checks

## Integrations covered

| Integration | Health check method | Notes |
|---|---|---|
| Gmail / Calendar / Drive / YouTube / Analytics / Search Console | `google-oauth` check-status | Single token covers all 6 |
| QuickBooks | `quickbooks-oauth` check-status | Includes realm + token refresh |
| RingCentral | `ringcentral-oauth` check-status | Phone system |
| Odoo | `sync-odoo-leads` check-status | ERP sync (env var check) |
| Facebook | `facebook-oauth` check-status | Page management |
| Instagram | `facebook-oauth` check-status (integration: instagram) | Via Meta API |
| LinkedIn | `linkedin-oauth` check-status | Social posting |
| TikTok | `tiktok-oauth` check-status | Video posting |
| Slack / Notion / Stripe / Twilio / Dropbox / Outlook | Not configured | Show as "Not Configured" |

## Technical implementation

### 1. New page: `src/pages/ConnectionsAudit.tsx`
- Admin-only page (reuse `useUserRole` guard pattern from `DataStoresAudit`)
- Calls all check-status endpoints in parallel using `Promise.allSettled`
- Cross-references live results with `integration_connections` table for last_sync timestamps
- Renders a table with status badges, timestamps, and action buttons
- Summary cards at top: total connected / warning / disconnected counts

### 2. Route registration in `src/App.tsx`
- Add route: `/admin/connections-audit` pointing to the new page
- Protected by the existing admin route wrapper `<P>`

### 3. Reuse existing infrastructure
- Uses the same edge function calls as `useIntegrations.ts` `checkAllStatuses`
- Reads `integration_connections` table for historical sync data
- No new edge functions or database changes needed

### Files to create
- `src/pages/ConnectionsAudit.tsx`

### Files to modify
- `src/App.tsx` (add route)
