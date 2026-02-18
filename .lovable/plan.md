

# Enterprise Alert Routing, Escalation, and Role-Specific Dashboards

This is a large-scale system upgrade spanning database schema, backend functions, and frontend dashboards. It is organized into 5 phases to deliver incremental value.

---

## What Already Exists

Your app already has strong foundations:
- **Notifications table** with user_id, type, priority, metadata, agent_name, link_to
- **Push notifications** via `send-push` and `push-on-notify` edge functions
- **Realtime subscriptions** on the notifications table
- **SLA tracking** (`sla_escalation_log`, `comms_alerts`, lead SLA deadlines)
- **CEO Portal** with BusinessHeartbeat, DailyBriefing, SLA Tracker, Fix Request Queue
- **Accounting Workspace** with full QuickBooks integration and Penny agent
- **Sales Pipeline** with AI actions, lead scoring, and stage management
- **Shop Floor** with machine monitoring, production runs, and station dashboards
- **Role-based access** (admin, sales, accounting, office, workshop, field, shop_supervisor, customer)
- **Gmail integration** for email sending
- **VAPID keys** for web push already configured

What's missing: a **centralized routing engine**, **escalation timers**, **multi-channel dispatch** (SMS, Slack), and **role-specific KPI dashboards** for Sales, Accounting, and Workshop roles.

---

## Phase 1: Alert Routing Engine (Database + Edge Function)

### Database: New Tables

**`alert_routing_rules`** -- Configurable rules mapping event categories to roles and channels
- id, company_id
- event_category (text): e.g. "finance", "sales", "production", "support", "hr", "system"
- event_type (text, nullable): e.g. "invoice_overdue", "deal_lost" -- null means all events in category
- target_roles (text[]): e.g. {"accounting", "admin"}
- channels (text[]): e.g. {"in_app", "email", "sms", "slack"}
- priority (text): "low", "normal", "high", "critical"
- escalate_to_role (text, nullable): e.g. "admin"
- escalate_after_minutes (integer, default 60)
- escalate_to_ceo_after_minutes (integer, nullable)
- enabled (boolean, default true)
- created_at, updated_at

**`alert_escalation_queue`** -- Tracks pending escalations
- id, company_id
- notification_id (references notifications)
- rule_id (references alert_routing_rules)
- escalation_level (integer, default 0): 0 = initial, 1 = manager, 2 = CEO
- escalate_at (timestamptz): when to escalate
- acknowledged_at (timestamptz, nullable)
- resolved_at (timestamptz, nullable)
- status (text): "pending", "escalated", "acknowledged", "resolved", "expired"
- created_at

**`alert_dispatch_log`** -- Audit trail for all dispatched alerts
- id, company_id
- notification_id (references notifications)
- channel (text): "in_app", "email", "sms", "slack"
- recipient_user_id (uuid, nullable)
- recipient_address (text): email, phone, or Slack channel
- status (text): "sent", "delivered", "failed", "bounced"
- sent_at, delivered_at
- error_message (text, nullable)
- metadata (jsonb)

### Edge Function: `alert-router`

Central dispatch function that:
1. Receives a structured event payload (category, type, severity, message, metadata, company_id)
2. Looks up matching rules from `alert_routing_rules`
3. Resolves target users from `user_roles` + `profiles` for matched roles
4. For each user x channel combination:
   - **in_app**: Insert into `notifications` table (existing path -- triggers push automatically)
   - **email**: Call `gmail-send` edge function with formatted alert email
   - **sms**: Call Twilio API (new -- requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER secrets)
   - **slack**: Call Slack connector gateway or webhook
5. Insert into `alert_dispatch_log` for audit
6. If rule has escalation, insert into `alert_escalation_queue` with `escalate_at` timestamp

### Edge Function: `check-escalations` (cron, every 5 minutes)

1. Query `alert_escalation_queue` where status = "pending" and escalate_at <= now()
2. For each pending escalation:
   - Check if the original notification was acknowledged (status = "read" or "actioned")
   - If not acknowledged: bump escalation_level, re-dispatch to escalate_to_role (or CEO at level 2)
   - Log new dispatch in `alert_dispatch_log`
   - Update queue entry

### Wire Existing Triggers to Alert Router

Update existing notification triggers (order status changes, quote requests, SLA breaches, leave requests, timeclock alerts) to call `alert-router` instead of directly inserting into `notifications`. This centralizes all routing logic.

---

## Phase 2: Multi-Channel Integrations

### SMS via Twilio
- New secrets needed: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
- SMS dispatch module inside `alert-router` calls Twilio REST API
- Phone numbers stored on profiles table (add `phone_number` column if missing)

### Slack Integration
- Connect Slack connector (bot type) for the workspace
- Slack dispatch module posts to configured channels using the connector gateway
- New column on `alert_routing_rules`: `slack_channel` (text) for channel routing

### Email Alerts
- Leverage existing `gmail-send` edge function
- Create HTML email templates for different alert categories (finance, sales, production)
- Include action buttons (acknowledge, view details) with deep links back to the app

---

## Phase 3: Role-Specific Dashboards

### Sales Dashboard (`/sales-dashboard`)
- Access: admin, sales roles
- KPI cards: Total pipeline value, win rate, avg deal size, new leads this week, sales cycle length
- Pipeline funnel visualization (existing stages data)
- Lead velocity chart (leads per week trend)
- SLA compliance for sales stages
- Top deals at risk (SLA breaching)
- Leaderboard by assigned sales rep
- Data sources: `leads`, `orders`, `activity_events`, `sla_escalation_log`

### Accounting Dashboard (enhance existing)
- Already has extensive dashboard via AccountingWorkspace
- Add: DSO (Days Sales Outstanding) KPI card
- Add: AR aging chart (0-30, 30-60, 60-90, 90+ days) from `accounting_mirror`
- Add: Budget variance card from `budgets` table
- Add: Alert summary strip showing open finance alerts

### Workshop Dashboard (`/workshop-dashboard`)
- Access: admin, workshop, shop_supervisor roles
- KPI cards: Machine utilization %, production throughput vs target, MTTR (mean time to resolution for machine blocks)
- Machine status grid (running/idle/blocked/down) with live updates
- Active work orders and completion progress
- SLA compliance for production stages
- Blocked items requiring attention
- Data sources: `machines`, `machine_runs`, `work_orders`, `work_order_items`

### Engineering/System Dashboard (part of CEO Portal)
- System uptime indicators
- Edge function error rates (from activity_events)
- Deployment/build status
- Open fix requests (existing FixRequestQueue)

---

## Phase 4: Guidance Monitor (Task-Centric View)

### New Component: `AlertGuidancePanel`
- A dedicated panel (can be opened side-by-side or as a full view) showing:
  - Prioritized queue of open alerts for the current user, color-coded by severity
  - Acknowledgment buttons on each alert
  - SOP checklist integration (when an alert links to a known procedure)
  - Time elapsed since alert was received
  - Escalation countdown ("Escalates to manager in 12 min")

### Alert Acknowledgment Flow
- When user clicks "Acknowledge" on an alert:
  - Update `alert_escalation_queue` entry to status = "acknowledged"
  - Update `notifications` entry to status = "read"
  - Log acknowledgment in `alert_dispatch_log`
  - Cancel pending escalation timer

### Notification Center Enhancement
- Add filter tabs: All | Finance | Sales | Production | System
- Add "Escalating in X min" badges on unacknowledged high-priority alerts
- Add bulk acknowledge by category

---

## Phase 5: Admin Configuration UI

### Alert Rules Manager (`/settings` > Alerts tab)
- Admin-only interface to create/edit/disable routing rules
- Form fields: event category, event type, target roles, channels, priority, escalation policy
- Preview: "This rule will send Finance/InvoiceOverdue alerts to Accounting via Email + In-App, escalating to Admin after 60 min"
- Import/export rules as JSON/YAML

### Alert Analytics
- Dashboard showing: alerts sent per day/week, acknowledgment rates, average response times, escalation rates, channel distribution
- Filterable by category, role, channel, time range

---

## Integration Architecture

```text
[Business Events] --> [alert-router Edge Function] --> Routing Rules DB
                                                          |
                          +-------------------------------+
                          |              |         |           |
                     [In-App]      [Email]    [SMS]      [Slack]
                     (notifications   (gmail-   (Twilio    (Connector
                      table +          send)     API)      Gateway)
                      push)
                          |
                    [escalation_queue]
                          |
                    [check-escalations cron] --> re-dispatch if unacknowledged
```

---

## Secrets Required

| Secret | Purpose | Status |
|--------|---------|--------|
| GMAIL_REFRESH_TOKEN | Email alerts | Already configured |
| VAPID keys | Push notifications | Already configured |
| TWILIO_ACCOUNT_SID | SMS alerts | Needs setup |
| TWILIO_AUTH_TOKEN | SMS alerts | Needs setup |
| TWILIO_FROM_NUMBER | SMS sender number | Needs setup |
| Slack connector | Slack messages | Needs connection |

---

## Estimated Changes Summary

| Component | Files | Effort |
|-----------|-------|--------|
| Database migrations (3 tables, triggers) | SQL | Medium |
| `alert-router` edge function | 1 new | High |
| `check-escalations` cron function | 1 new | Medium |
| Sales Dashboard page + components | 3-5 new | High |
| Workshop Dashboard page + components | 3-5 new | High |
| Accounting Dashboard enhancements | 2-3 edits | Medium |
| AlertGuidancePanel component | 1 new | Medium |
| Notification Center enhancements | 2-3 edits | Medium |
| Alert Rules Manager (settings) | 2-3 new | Medium |
| Route registrations | 1 edit | Low |

We will implement phase by phase, starting with Phase 1 (the routing engine) since everything else depends on it.

