

## 24/7 Live Business Watchdog — Always-On Monitoring + Data Refresh

### Current State: 24 Active Cron Jobs

Your system already has strong scheduled sync coverage:

| Frequency | Function | What it does |
|---|---|---|
| Every 5 min | `gmail-sync` | Syncs all user emails |
| Every 5 min | `ringcentral-sync` | Syncs all calls |
| Every 5 min | `social-cron-publish` | Publishes scheduled posts |
| Every 5 min | `check-escalations` | Escalates unread alerts |
| Every 15 min | `qb-sync-engine` (x2) | QuickBooks incremental + reconcile |
| Every 1 hour | `email-automation-check` | Auto-email triggers |
| Every 2 hours | `approval-notify` | Escalates unapproved items |
| Every 12 hours | `system-backup` | Full backup |
| Daily | `daily-team-report`, `auto-reconcile`, `penny-auto-actions`, `embed-documents`, `auto-clockout` | Various daily ops |

### What's MISSING

1. **No `ai-health-cron`** — The edge function exists but has no cron job scheduled
2. **No business watchdog** — Nobody is scanning for anomalies (stalled production, unanswered emails, overdue invoices) between Vizzy sessions
3. **No Vizzy context refresh** — `vizzy-pre-digest` only runs on-demand when user opens chat, not continuously

### Plan: Add 3 New Cron Jobs + 1 New Edge Function

---

#### Job 1: Schedule `ai-health-cron` (every 5 min)

The function already exists at `supabase/functions/ai-health-cron/index.ts`. Just needs a cron entry.

---

#### Job 2: Create `vizzy-business-watchdog` Edge Function (every 15 min)

**New file**: `supabase/functions/vizzy-business-watchdog/index.ts`

A lightweight scan that checks ALL domains and writes alerts to `notifications` table when anomalies are detected:

**Checks:**
- **Emails**: Inbound emails older than 4 hours with no outbound reply → alert "Unanswered email from {sender}: {subject}"
- **Pipeline**: Leads in same stage for >7 days with no activity → alert "Stalled lead: {title}"
- **Production**: Cut plan items with <50% progress and delivery due in <5 days → alert "At-risk production: {barcode}"
- **Deliveries**: Scheduled today but status not 'in_transit' or 'delivered' → alert "Delivery not dispatched: {number}"
- **Financials**: Invoices overdue >30 days → alert "Overdue invoice: {customer} ${amount}"
- **Team**: Employees clocked in >10 hours ago without clock-out → alert "Long shift: {name}"
- **Integrations**: Check `integration_connections` for `status = 'error'` → alert "Integration down: {provider}"

Uses `dedupe_key` to prevent duplicate alerts within 24 hours.

---

#### Job 3: Schedule `vizzy-pre-digest` (every 30 min during business hours)

Pre-warm Vizzy's context so when CEO opens chat, data is already fresh. Only runs 7 AM - 10 PM EST.

---

### Implementation

| Item | Action |
|---|---|
| `supabase/functions/vizzy-business-watchdog/index.ts` | New edge function — anomaly scanner |
| SQL insert (cron) | 3 new cron jobs: ai-health-cron (5min), watchdog (15min), pre-digest (30min business hours) |

### What is NOT changed
- Existing cron jobs untouched
- No schema changes (uses existing `notifications` table)
- No frontend changes
- Existing edge functions unchanged

