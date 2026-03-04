

# Fix Odoo Sync & Refresh All Tabs

## Problem
The `ODOO_ENABLED` secret exists but its value is likely not set to `"true"`, causing the sync functions (`odoo-crm-sync`, `odoo-chatter-sync`) to return "disabled".

## Fix

1. **Update `ODOO_ENABLED` secret** to value `true` — this is the only blocker. No code changes needed.

2. After the secret is updated, clicking "Sync Odoo" on the Pipeline page will:
   - Run `odoo-crm-sync` → updates leads, stages, lead_events
   - Then `odoo-chatter-sync` → populates `lead_activities` (chatter messages) and `scheduled_activities`

3. All four tabs already read from the correct tables:
   - **Notes** — `chat_threads` / `chat_thread_messages`
   - **Chatter** — `lead_activities` + `lead_communications` + `lead_events` (already fixed in previous change)
   - **Activities** — `scheduled_activities`
   - **Timeline** — `lead_events`

| Action | Detail |
|--------|--------|
| Update secret `ODOO_ENABLED` | Set value to `true` |

