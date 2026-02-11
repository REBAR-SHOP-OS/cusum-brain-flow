

## Comms Engine: Human-AI Pairing, Alerts, Draft-Only, Email Routing

This translates your YAML config into the existing Supabase + Edge Functions architecture. No YAML files or CLI commands -- everything lives in the database and edge functions you already have.

---

### Phase 1: Database Tables (3 new tables)

**Table: `comms_agent_pairing`** -- maps each human to their AI shadow

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_email | text UNIQUE NOT NULL | e.g. saurabh@rebar.shop |
| agent_name | text NOT NULL | e.g. Blitz, Relay, Penny |
| rc_extension | text | e.g. ext206 |
| draft_only | boolean DEFAULT false | true for Relay |
| company_id | uuid FK -> companies | |
| created_at | timestamptz | |

Pre-seeded with all 7 pairings:
- saurabh@rebar.shop -> Blitz (ext206)
- neel@rebar.shop -> Blitz (ext209)
- radin@rebar.shop -> Relay (ext222, draft_only=true)
- vicky@rebar.shop -> Penny (ext201)
- ben@rebar.shop -> Gauge (ext203)
- sattar@rebar.shop -> Vizzy (ext101)
- kourosh@rebar.shop -> Forge (no extension)
- josh@rebar.shop -> Vizzy (ext202, unpaired default)

**Table: `comms_config`** -- company-level settings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid UNIQUE FK | |
| external_sender | text DEFAULT 'rfq@rebar.shop' | for customer-facing |
| internal_sender | text DEFAULT 'ai@rebar.shop' | for employee-facing |
| internal_domain | text DEFAULT 'rebar.shop' | |
| response_thresholds_hours | jsonb DEFAULT '[2,4,24]' | escalation tiers |
| missed_call_alert | text DEFAULT 'instant' | |
| daily_brief_time | text DEFAULT '08:00' | |
| brief_recipients | text[] DEFAULT '{ai@rebar.shop}' | |
| no_act_global | boolean DEFAULT true | tracking-only mode |
| ceo_email | text DEFAULT 'sattar@rebar.shop' | alert escalation target |

**Table: `comms_alerts`** -- tracks alert events

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| alert_type | text NOT NULL | response_time_2h, response_time_4h, response_time_24h, missed_call |
| communication_id | uuid FK -> communications | the triggering comm |
| owner_email | text NOT NULL | who owns this comm |
| owner_notified_at | timestamptz | null until notified |
| ceo_notified_at | timestamptz | null until escalated |
| resolved_at | timestamptz | null until resolved |
| metadata | jsonb | extra context |
| company_id | uuid FK | |
| created_at | timestamptz DEFAULT now() | |

RLS: All 3 tables scoped to authenticated users with admin/office roles for writes, all internal users for reads.

---

### Phase 2: New Edge Function -- `comms-alerts`

A cron-triggered function that runs every 15 minutes:

**Response-time monitoring:**
1. Query `communications` for inbound emails where `received_at` is older than 2h/4h/24h
2. Check if a reply exists in the same thread (outbound comm with matching `thread_id` after `received_at`)
3. If no reply found and no alert already exists in `comms_alerts` for this threshold, create one
4. Look up owner via `comms_agent_pairing` (match `from_address` or `to_address`)
5. Send alert email to the owner first, then CC to CEO (`comms_config.ceo_email`)

**Missed-call monitoring:**
1. Query `communications` where `source = 'ringcentral'` and metadata contains `result: 'Missed'`
2. If no alert exists yet for this communication_id, create one
3. Map the RC extension back to the owner via `comms_agent_pairing.rc_extension`
4. Send instant alert to owner + CEO

**Alert email format:**
- Sent FROM `ai@rebar.shop` (internal sender)
- Subject: "[Alert] Unanswered email from {contact} - {hours}h" or "[Alert] Missed call from {number}"
- Body: Summary of the communication, link context, owner name, AI shadow agent name

**Cron setup** (via pg_cron + pg_net):
```sql
SELECT cron.schedule('comms-alerts-check', '*/15 * * * *', ...);
```

---

### Phase 3: Update `gmail-send` -- Email Routing Rules

Add sender identity enforcement when agents send emails:

1. Accept new optional field `sent_by_agent: boolean` in the request body
2. When `sent_by_agent` is true:
   - Fetch `comms_config` for the company
   - Check recipient domain: if NOT `internal_domain` (rebar.shop), use `external_sender` (rfq@rebar.shop)
   - If recipient IS internal, use `internal_sender` (ai@rebar.shop)
3. When `sent_by_agent` is false or missing, use the user's own Gmail address (current behavior)

Also check `no_act_global` from `comms_config` -- if true, block all agent-initiated sends and return `{ blocked: true, reason: "tracking_only" }`.

---

### Phase 4: Draft-Only Enforcement for Relay

In `ai-agent` edge function:

1. After authenticating the user, look up their email in `comms_agent_pairing`
2. If `draft_only = true` (Relay / radin@rebar.shop):
   - Remove any "send email" or "send message" capabilities from the agent's tool set
   - Agent can still draft content and suggest replies, but the system prevents execution
3. Also check `comms_config.no_act_global` -- when true, ALL agents are stripped of send capabilities (global tracking-only mode)

---

### Phase 5: Update `userAgentMap.ts` -- Complete Pairings

Add missing mappings and update existing ones:

```text
saurabh@rebar.shop -> sales (Blitz)     [NEW]
neel@rebar.shop    -> sales (Blitz)     [UPDATE from assistant]
radin@rebar.shop   -> support (Relay)   [NEW]
vicky@rebar.shop   -> accounting (Penny) [NEW]
josh@rebar.shop    -> assistant (Vizzy)  [NEW]
```

Keep existing mappings unchanged:
- sattar@rebar.shop -> assistant (Vizzy)
- kourosh@rebar.shop -> shopfloor (Forge)
- ben@rebar.shop -> estimating (Gauge)

Each new entry gets role-appropriate `quickActions` and `heroText`.

---

### Phase 6: Daily Brief Enhancement

Update `email-activity-report` edge function:

1. Pull `comms_config` to get `brief_recipients` and `ceo_email`
2. Add alert summary section to the daily brief:
   - Count of open response-time breaches by tier (2h/4h/24h)
   - Count of missed calls in last 24h
   - Per-person breakdown with their paired AI agent name
3. Send master report to all `brief_recipients` (default: ai@rebar.shop)
4. Include per-person AI shadow agent name in the leaderboard (e.g. "Saurabh (Blitz)")

---

### Files Changed

| File | Change |
|------|--------|
| **New migration** | Create `comms_agent_pairing`, `comms_config`, `comms_alerts` tables + RLS + seed data |
| **New: `supabase/functions/comms-alerts/index.ts`** | Response-time + missed-call alert engine |
| `supabase/functions/gmail-send/index.ts` | Add `sent_by_agent` routing + `no_act_global` check |
| `supabase/functions/ai-agent/index.ts` | Draft-only + no_act_global enforcement |
| `src/lib/userAgentMap.ts` | Add saurabh, radin, vicky, josh; update neel to Blitz |
| `supabase/functions/email-activity-report/index.ts` | Pull config, add alert summary, include agent names |
| `supabase/config.toml` | Add `[functions.comms-alerts]` entry |
| **New cron (SQL insert)** | Schedule `comms-alerts` every 15 min via pg_cron |

### Alert Routing (as confirmed)

```text
Alert triggered
  |
  +--> Email to OWNER (the person who missed/delayed)
  |
  +--> Email to CEO (sattar@rebar.shop)
```

Both sent from ai@rebar.shop.

### What Is NOT Changed
- No UI changes (all config is backend)
- Gmail and RingCentral sync functions continue as-is
- Existing manual email sending is unaffected
- No changes to agent personas or Brain knowledge

