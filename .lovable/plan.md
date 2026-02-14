

# Add rebar.shop (WordPress) Integration

## Overview
Add a dedicated **rebar.shop** WordPress integration card to the Integrations page, allowing easy access to configure and modify the WordPress REST API connection for your live site.

## What Will Be Done

### 1. Store Credentials Securely
Your WordPress credentials will be stored as encrypted backend secrets (not in code):
- `WP_BASE_URL` -- the API endpoint (`https://rebar.shop/wp-json/wp/v2`)
- `WP_USERNAME` -- your WordPress admin username
- `WP_APP_PASSWORD` -- the Application Password

### 2. Add Integration Card
A new "rebar.shop" entry will appear in the integrations list alongside Gmail, Slack, etc., with three configurable fields:
- **API Base URL** (text) -- defaults to `https://rebar.shop/wp-json/wp/v2`
- **Username** (text)
- **Application Password** (password)

### 3. Add WordPress Icon
A custom WordPress "W" icon will be added to the `IntegrationIcons.tsx` component.

## Technical Details

### Files to modify:
1. **`src/components/integrations/integrationsList.ts`** -- Add the `rebar-shop` integration entry with three fields (WP_BASE_URL, WP_USERNAME, WP_APP_PASSWORD)
2. **`src/components/integrations/IntegrationIcons.tsx`** -- Add a `rebar-shop` case with the WordPress logo SVG

### Secrets to create:
- `WP_BASE_URL` = `https://rebar.shop/wp-json/wp/v2`
- `WP_USERNAME` = `Admin`
- `WP_APP_PASSWORD` = (your application password, entered securely)

These secrets will be available in backend functions for any future WordPress API calls (products, orders, posts, etc.).

