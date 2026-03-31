

# Plan: Generate Final Production-Ready System Specification

## Scope
Generate `/mnt/documents/system-rebuild-blueprint-v2.md` covering:
- **193+ edge functions** — full API contracts
- **40+ realtime channels** — table subscriptions and payload structures
- **7 external integrations** — QuickBooks, Gmail, RingCentral, Meta/Facebook, LinkedIn, WordPress, ElevenLabs
- **Validation matrix** — all functions cross-referenced

## Data Confirmed (from exploration)

### Edge Functions (193 total)
All functions use the shared `handleRequest` wrapper with these config options:
- `authMode`: "required" (default) | "optional" | "none"
- `requireCompany`: boolean (default true)
- `wrapResult`: boolean (default true — wraps in `{ok, data}`)
- `rawResponse`: boolean (for streaming/binary responses)
- `parseBody`: boolean (for FormData/multipart)
- `requireRole` / `requireAnyRole`: role-based access

### Realtime Tables (from migrations)
Tables with `ALTER PUBLICATION supabase_realtime ADD TABLE`:
notifications, inventory_reservations, cut_output_batches, inventory_lots, team_meetings, bend_batches, bundles, machines, machine_runs, cut_plan_items, pickup_orders, clearance_evidence, cut_plans, alert_escalation_queue, call_tasks, vizzy_memory, automation_runs, automation_configs, tasks, communications, events, sales_quotation_items, sales_invoice_items, sales_leads, lead_activities, machine_capabilities, meeting_transcript_entries, leads, social_posts, and more.

### Client-Side Channels (from src/hooks)
39 files with `.channel()` calls covering: station data, bundles, waste bank, time clock, pickup orders, notifications, unread senders, barlists, penny queue, extract sessions, meeting transcription, social approvals, team chat, bender batches, purchasing list, clearance data, cut plans, inventory, deliveries, orders, and more.

### Integrations
- **QuickBooks**: OAuth2 (client_id/secret), HMAC-SHA256 webhook verification, token refresh, realm_id scoping
- **Gmail**: OAuth2 per-user tokens (user_gmail_tokens), pub/sub watch, encrypted refresh tokens
- **RingCentral**: OAuth2 dual-app (frontend embeddable + backend), JWT migration, SIP provisioning
- **Meta/Facebook**: Graph API v21.0, page token refresh, Instagram container publishing
- **LinkedIn**: OAuth2 for page publishing via social-publish
- **WordPress**: WP REST API + WooCommerce API via WPClient helper
- **ElevenLabs**: API key auth for TTS, music, scribe, conversation tokens

### Agent System (21 agents)
Prompt files in: sales.ts, accounting.ts, operations.ts, support.ts, marketing.ts, growth.ts, specialists.ts, empire.ts, purchasing.ts

## Approach

A Python script will:

1. **Query the live database** via `psql` for:
   - All realtime publication tables
   - Function source code for triggers referenced by realtime tables

2. **Read all 193 edge function `index.ts` files** to extract:
   - Handler options (authMode, requireCompany, wrapResult, rawResponse)
   - Zod schemas (request validation)
   - Response shapes
   - Side effects (DB writes, external API calls)
   - Error responses (status codes + bodies)

3. **Read all 9 agent prompt files** for verbatim system prompts

4. **Read all 39 realtime hook files** for channel patterns and event handling

5. **Compile into structured Markdown** with the exact format specified:
   - Section 1: Every edge function with route, method, auth, request/response schemas, errors, side effects
   - Section 2: Every realtime channel with source table, events, payload, RLS behavior
   - Section 3: Every integration with trigger, request/response, auth, retry logic
   - Section 4: Validation matrix table

## Output
- File: `/mnt/documents/system-rebuild-blueprint-v2.md`
- Estimated size: 800KB-1.2MB
- Format: Pure structured Markdown, zero narrative

## Impact
- 0 codebase files modified
- 1 artifact generated

