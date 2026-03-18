

## Employee Activity Tracking + Vizzy Intelligence Upgrade

### What You're Asking For
1. Every employee's actions should be logged — what they did, when, where
2. Every employee should have direct access to Vizzy (not just super admins)
3. Vizzy should monitor all emails with a bird's-eye view
4. You should be able to ask Vizzy "what did [employee] do today?" and get a full report

### Current State (What Already Exists)
- **Activity logging** already exists (`activity_events` table) but only ~5 components write to it — most employee actions (viewing pages, updating leads, sending emails, using agents) are NOT logged
- **Vizzy access** is restricted to super admins only (`sattar@rebar.shop`, `radin@rebar.shop`)
- **Email monitoring** — Vizzy already has inbound emails in context, but lacks per-employee email send tracking
- **Employee performance data** — Vizzy context already includes work orders, agent sessions, time clock, and agent actions per employee (good foundation)

### Plan

**1. Open Vizzy Access to All Employees**
- Remove the super-admin restriction on `FloatingVizzyButton` in `AppLayout.tsx` — show it for all authenticated `@rebar.shop` users
- Remove the super-admin block in `AgentWorkspace.tsx` that redirects non-super-admins away from the "assistant" agent
- Keep the admin-chat edge function's full-data context only for super admins; for regular employees, use a scoped context showing only their own data
- Update `Home.tsx` to show the Vizzy helper card for all users (currently filtered out for non-super-admins)

**2. Add Comprehensive Employee Action Logging**
Create a lightweight client-side logger (`src/lib/activityLogger.ts`) that writes to `activity_events` on key user actions:
- **Page navigation** — log when employees visit key pages (orders, leads, deliveries, accounting)
- **Data mutations** — wrap existing mutation hooks to auto-log: lead status changes, order updates, delivery updates, quote creation
- **Agent interactions** — already tracked via `chat_sessions`, but add a log when an employee explicitly asks their agent to do something
- **Email sends** — log when employees send emails through the system

Integrate the logger into:
- `AppLayout.tsx` (navigation tracking via route changes)
- Key mutation hooks (`useOrders`, lead/delivery update functions)
- `gmail-send` edge function (log outbound emails with sender)

**3. Add Vizzy Tools for Employee Activity Queries**
Add two new read tools to `admin-chat/index.ts`:
- `get_employee_activity(employee_name?, date?, limit?)` — queries `activity_events` filtered by `actor_id`, joined with profiles to resolve names. Returns what the employee did, when, and on which entity.
- `get_employee_emails(employee_name?, date?, direction?)` — queries `communications` filtered by employee email address, showing sent/received emails with subjects and timestamps.

**4. Enrich Vizzy's Email Bird's-Eye View**
Update `vizzyFullContext.ts` to include:
- **Outbound email counts per employee** (from `communications` where `direction = 'outbound'`)
- **Email response times** — average time between inbound and outbound on same thread
- **Unread/unanswered email count** — inbound emails with no corresponding outbound reply

**5. Add Employee Activity Summary to Vizzy Context**
Expand the `EMPLOYEE PERFORMANCE` section in `vizzyFullContext.ts` to include:
- Per-employee action count from `activity_events` (grouped by `actor_id`)
- Per-employee page visit count (from the new navigation logging)
- Per-employee email send/receive counts

### Technical Details

**Files to create:**
- `src/lib/activityLogger.ts` — client-side action logger utility

**Files to modify:**
- `src/components/layout/AppLayout.tsx` — remove super-admin gate on FloatingVizzyButton, add navigation logger
- `src/components/vizzy/FloatingVizzyButton.tsx` — remove `isSuperAdmin` check, allow all `@rebar.shop` users
- `src/pages/AgentWorkspace.tsx` — remove super-admin block for "assistant" agent, add role-based context scoping
- `src/pages/Home.tsx` — show Vizzy helper for all users
- `supabase/functions/admin-chat/index.ts` — add `get_employee_activity` and `get_employee_emails` tools + handlers
- `supabase/functions/_shared/vizzyFullContext.ts` — add outbound email stats per employee and activity event aggregation per employee

**No database changes needed** — `activity_events` already has `actor_id`, `actor_type`, and all necessary columns.

