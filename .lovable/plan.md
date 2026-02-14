
# Email Marketing Automations — 8 Trigger-Based Workflows

## Overview

Add an **Automations** tab/section to the Email Marketing page with 8 pre-built automation templates. Each automation is a database-driven workflow that can be toggled on/off by Neel, with AI-generated email drafts that still require human approval before sending.

## New Database Table: `email_automations`

Stores each automation configuration and its on/off state:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| automation_key | text UNIQUE | e.g. `abandoned_cart`, `welcome_series` |
| name | text | Display name |
| description | text | What it does |
| trigger_type | text | `quote_stale`, `new_contact`, `order_complete`, etc. |
| campaign_type | text | Maps to existing campaign types |
| enabled | boolean (default false) | Toggle on/off |
| config | jsonb | Delay hours, conditions, template hints |
| priority | text | `high`, `medium`, `low` |
| company_id | uuid | |
| created_at / updated_at | timestamps | |

RLS: Same company-based policy as email_campaigns.

## Seed Data (8 Automations)

| Key | Name | Trigger | Priority |
|-----|------|---------|----------|
| `abandoned_cart` | Abandoned Quote Follow-up | Quote status = `sent`, no order after 48h | High |
| `welcome_series` | Welcome Series | New contact created | High |
| `upsell_email` | Upsell / Cross-sell | Order completed, suggest related services | High |
| `review_request` | Review Request | Order delivered + 7 days | Medium |
| `birthday_promo` | Birthday / Anniversary | Contact anniversary (yearly) | Medium |
| `price_stock_alert` | Price/Stock Alert | Manual trigger or inventory change | Medium |
| `vip_email` | VIP Recognition | Customer total orders > threshold | Low |
| `winback` | Win-Back | No orders in 90+ days | Low |

## New Edge Function: `email-automation-check`

A schedulable function (cron every hour) that:
1. Reads all enabled automations
2. For each, queries the relevant trigger conditions (e.g. stale quotes, new contacts without welcome email)
3. For qualifying contacts, calls the existing `email-campaign-generate` logic to create a draft campaign with status `pending_approval`
4. Neel reviews and approves as usual -- no auto-sending

## Frontend Changes

### 1. `src/components/email-marketing/AutomationsPanel.tsx` (new)
- Grid of 8 automation cards with toggle switches
- Each card shows: name, description, trigger description, priority badge, enabled/disabled toggle
- Click card to expand config (delay hours, conditions)
- Stats: how many campaigns each automation has generated

### 2. `src/pages/EmailMarketing.tsx` (updated)
- Add "Automations" tab alongside existing campaign list
- Tab bar: **Campaigns** | **Automations**
- Automations tab renders the new `AutomationsPanel`

### 3. `src/hooks/useEmailAutomations.ts` (new)
- CRUD hook for `email_automations` table
- Toggle enabled/disabled mutation
- Query for automation stats

## Technical Details

### Database Migration
```sql
-- email_automations table
-- Seed 8 rows with default configs
-- RLS policies matching email_campaigns pattern
```

### Edge Function: `email-automation-check/index.ts`
- Auth: service_role (cron-triggered)
- For each enabled automation, run trigger query:
  - `abandoned_cart`: quotes with status='sent', created_at < now()-48h, no matching order
  - `welcome_series`: contacts created in last 24h without a welcome campaign send
  - `upsell_email`: orders with status='closed' or 'paid', completed in last 7 days, no upsell campaign
  - `review_request`: orders delivered 7+ days ago, no review request sent
  - `winback`: customers with last order > 90 days ago
  - Others: config-driven thresholds
- Creates campaign via DB insert (status: `pending_approval`) -- NOT via AI initially (to keep it fast). AI generation happens when Neel clicks "Generate Draft" on the pending automation campaign.

### Automation Card Component
- Toggle switch calls `useEmailAutomations.toggle(id, enabled)`
- Priority badge with color coding (High=red, Medium=amber, Low=gray)
- Shows last triggered date and count of generated campaigns

### Files to Create
1. `src/components/email-marketing/AutomationsPanel.tsx`
2. `src/hooks/useEmailAutomations.ts`
3. `supabase/functions/email-automation-check/index.ts`

### Files to Modify
1. `src/pages/EmailMarketing.tsx` — add Automations tab
2. Database migration — create table + seed data + RLS

### Validation trigger
- Reuse existing pattern: validate `automation_key` and `priority` values
