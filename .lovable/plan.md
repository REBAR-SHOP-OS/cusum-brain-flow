

# Vizzy End-to-End Plan — Updated for rebar.shop OS

## Current State (What's Already Built)

### Database Tables (PostgreSQL — Single Source of Truth)
All core domain tables exist: `customers`, `contacts`, `quotes`, `orders`, `work_orders`, `deliveries`, `delivery_stops`, `accounting_mirror`, `communications`, `events`, `tasks`, `knowledge`, `leads`, `machines`, `machine_runs`, `inventory_lots`, `floor_stock`, `notifications`, `time_clock_entries`, `profiles`, `user_roles`, plus specialized tables for cut plans, barlists, extraction, payroll, social, and meetings.

### Edge Functions (50 deployed)
AI agents, Gmail sync/send, RingCentral sync/calls/video/recording, QuickBooks OAuth, daily summary, pipeline AI, payroll engine, smart dispatch, shape vision, OCR, face recognition, social publishing, meeting notes, and more.

### Agents (15 trained, all active)
Sales (Blitz), Accounting (Penny), Support (Haven), Collections, Estimation (Gauge), Social (Pixel), Eisenhower, BizDev (Buddy), WebBuilder (Commet), Assistant (Vizzy), Copywriting (Penn), Talent (Scouty), SEO (Seomi), Growth (Gigi), Legal (Tally). All have Ontario context, role-aware access control, and idea generation triggers.

### UI Pages (43 routes)
Home, Inbox (agents + unified inbox), Pipeline, Customers, Accounting workspace, Shop Floor, Deliveries, Office Portal (CEO dashboard, inventory, live monitor, payroll audit, transcription, extraction, packing slips), Brain, Tasks, Settings, Team Hub, Social Media Manager, Phone calls, Time Clock, CEO Portal, and more.

### Security
RLS on all tables, role-based access (admin/accounting/office/workshop/sales/field), company-scoped isolation, financial audit logging, contact access monitoring, rate limiting.

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation (hosting, cache, sidebar, base pages) | DONE |
| Phase 1 | Comms to Tasks (email/call to task, draft replies, timeline) | DONE -- Gmail sync, RingCentral sync, task creation, event logging all working |
| Phase 2 | CRM Context (customer + AR in every conversation) | DONE -- customers/contacts tables, Gmail linked to contacts, QB balance in accounting_mirror |
| Phase 3 | QuickBooks Mirror (read-only sync) | DONE -- accounting_mirror table, QB OAuth, sync functions |
| Phase 4 | Sales Agent (chat to quote, margin guardrails) | DONE -- Gauge (estimation) agent with multi-pass OCR, quote drafting, validation rules |
| Phase 5 | Shop Floor UI (work orders, scan/start/complete) | DONE -- full station views, machine registry, cut engine, bender station, foreman panel, clearance |
| Phase 6 | Delivery UI (loads, stops, POD, exceptions) | DONE -- delivery terminal, POD capture, stop issues, pickup verification |
| Phase 7 | Agent Expansion | DONE -- all 15 agents trained with Ontario rules, role access, idea generation |
| Phase 8 | Remove Odoo | IN PROGRESS -- Odoo sync functions still exist (sync-odoo-leads, sync-odoo-quotations, sync-odoo-history, odoo-file-proxy) |

---

## What Remains to Complete the Vision

### Phase 8 Completion: Odoo Removal
- Run parallel comparison period
- Freeze Odoo sync functions
- Archive/remove: `sync-odoo-leads`, `sync-odoo-quotations`, `sync-odoo-history`, `odoo-file-proxy`, `pipeline-ai/odooHelpers.ts`
- Remove Odoo secrets (ODOO_URL, ODOO_USERNAME, ODOO_API_KEY, ODOO_DATABASE) after freeze

### Vizzy Consciousness Loops — Mapping to Existing Infrastructure

```text
LOOP                 EXISTING IMPLEMENTATION
--------------------------------------------------------------
1. PERCEPTION        Gmail sync, RingCentral sync, shop floor
                     realtime, delivery events, QB mirror,
                     extraction (OCR/PDF). All feed into
                     PostgreSQL tables with realtime enabled.

2. MEMORY            Short-term: chat_sessions + chat_messages
                     Long-term: knowledge table (Brain),
                     customers, contacts, system_learnings,
                     estimation_learnings
                     Immutable: events table (audit timeline)

3. ORIENTATION       CEO Portal (health scores, KPIs,
                     exceptions workbench), daily-summary
                     edge function, notifications with
                     priority levels, idea generation

4. CONVERSATION      15 trained agents via ai-agent edge
                     function, admin-chat (Admin Console),
                     rich markdown rendering, file analysis

5. DECISION          All agents draft-only, human approval
                     required, create_notifications tool for
                     ideas/tasks, role-aware access control

6. ACTION            handle-command, smart-dispatch,
                     gmail-send, social-publish,
                     manage-inventory, log-machine-run,
                     payroll-engine — all require auth
```

### Voice Vizzy (Not Yet Built)
- "Talk to Vizzy" button: requires speech-to-text integration
- Phone-based Vizzy via RingCentral: `ringcentral-ai` edge function exists but needs voice pipeline
- Transcription panel with action chips exists in `TranscribeView` (meeting transcription)
- `useSpeechRecognition` hook exists for browser-based voice input
- `VoiceRecorderWidget` exists on shop floor

### Remaining Gaps (Ordered by Impact)

1. **Unified Events Timeline UI** -- `events` table exists with full schema but no dedicated timeline view component. Events are logged but not surfaced as a browsable timeline for users.

2. **Cross-Agent Memory** -- Agents don't share conversation context between sessions. Vizzy (assistant) should be able to reference what Blitz (sales) discussed earlier. Requires reading `chat_sessions` + `chat_messages` in the assistant agent's context fetch.

3. **Proactive Monitoring Loop** -- Agents only respond when asked. A scheduled function (cron) that runs daily to scan for idea triggers and auto-create notifications would complete the "24/7" aspect. The `daily-summary` function partially does this but is user-triggered.

4. **Voice Pipeline** -- Speech-to-text input exists (`useSpeechRecognition`), but no TTS output or "talk to Vizzy" mode that loops voice in/out continuously.

5. **Odoo Sunset** -- 4 edge functions + helpers still active for Odoo sync.

---

## No Changes Needed Now

This is a status update and blueprint alignment. The system is at Phase 7 complete / Phase 8 in progress. All 6 consciousness loops are implemented through existing infrastructure. The remaining work is incremental: events timeline UI, cross-agent memory, scheduled proactive scanning, voice pipeline, and Odoo removal.

