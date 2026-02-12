

# Add Odoo Integration Card to Integrations Page

## What will change

An **Odoo** card will appear on the Integrations page alongside the existing integrations (Gmail, Slack, Stripe, etc.), allowing users to connect their Odoo instance by entering their credentials.

## Implementation

### 1. Add Odoo icon to IntegrationIcons.tsx
Add a new `"odoo"` case to the icon switch statement -- the official Odoo purple gear/cog logo as an inline SVG.

### 2. Add Odoo entry to integrationsList.ts
Insert an Odoo integration object into the `defaultIntegrations` array with:
- **id**: `"odoo"`
- **name**: `"Odoo"`
- **description**: `"Sync leads, quotations, and ERP data from Odoo."`
- **icon**: `"odoo"`
- **docsUrl**: `"https://www.odoo.com/documentation/17.0/developer/reference/external_api.html"`
- **fields**:
  - `ODOO_URL` (text) -- Odoo instance URL
  - `ODOO_DATABASE` (text) -- Database name
  - `ODOO_USERNAME` (text) -- Login username
  - `ODOO_API_KEY` (password) -- API key from Odoo settings

These match the secrets already used by existing edge functions (`sync-odoo-leads`, `sync-odoo-quotations`).

### Files to modify
- `src/components/integrations/IntegrationIcons.tsx` -- add Odoo SVG icon
- `src/components/integrations/integrationsList.ts` -- add Odoo entry

