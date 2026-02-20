

# Phase 16: Maximize RingCentral Integration

## Overview
The current RingCentral integration covers OAuth, call/SMS sync, WebRTC calling, recording AI analysis, video bridges, and Vizzy-initiated actions. This phase unlocks the remaining high-value RingCentral APIs to create a complete telephony command center.

---

## What Already Exists
- OAuth + JWT authentication (`ringcentral-oauth`)
- Call log & SMS sync (`ringcentral-sync`)
- Real-time webhook for calls & SMS (`ringcentral-webhook`)
- WebRTC softphone via SIP provisioning (`ringcentral-sip-provision`, `useWebPhone`)
- Embeddable widget (`useRingCentralWidget`)
- AI call recording analysis with Gemini (`ringcentral-ai`)
- Recording proxy/download (`ringcentral-recording`)
- RingOut + SMS send via Vizzy (`ringcentral-action`)
- Video bridge creation (`ringcentral-video`)
- Call summarization (`summarize-call`)

## What's Missing (High-Value APIs Not Yet Used)

### Track 1: Real-Time Presence & Availability
**RingCentral API**: `/restapi/v1.0/account/~/extension/~/presence`

Currently team presence is only tracked via time clock. RingCentral presence shows actual phone availability (Available, Busy, On-Call, DND, Offline).

**Deliverables:**
- New edge function `ringcentral-presence` -- polls/subscribes to presence for all connected users
- New `rc_presence` table to cache presence states (user_id, status, dnd_status, telephony_status, updated_at)
- New `useRCPresence` hook for real-time presence data
- `RCPresenceIndicator` component -- colored dot (green/yellow/red) on team member avatars throughout the app
- Integrate into `BusinessHeartbeat.tsx` Team Presence card, `TeamHub` member list, and contact cards

### Track 2: Voicemail Access & AI Transcription
**RingCentral API**: `/restapi/v1.0/account/~/extension/~/message-store?messageType=VoiceMail`

Voicemails are currently invisible in the app.

**Deliverables:**
- Extend `ringcentral-sync` to fetch voicemails (messageType=VoiceMail) alongside SMS
- Store voicemails in `communications` table with metadata type "voicemail"
- New `VoicemailPlayer` component -- inline audio player with AI transcription button (reuses `ringcentral-ai` for transcription)
- Add "Voicemail" filter tab in `UnifiedInboxList`
- Auto-transcribe new voicemails via webhook handler

### Track 3: Fax Integration
**RingCentral API**: `/restapi/v1.0/account/~/extension/~/fax` (send) + message-store (receive)

Rebar shops frequently receive faxed plans and specs.

**Deliverables:**
- Extend `ringcentral-sync` to fetch fax messages (messageType=Fax)
- Store faxes in `communications` with metadata type "fax" and attachment URIs
- New edge function `ringcentral-fax-send` -- send fax with PDF attachment
- New `FaxViewer` component -- renders fax attachments inline with download option
- `SendFaxDialog` component -- upload PDF + enter recipient fax number
- Add "Fax" filter in Inbox

### Track 4: Call Analytics Dashboard
**RingCentral API**: Call log data (already synced) + aggregation

Raw call data exists but no analytics view.

**Deliverables:**
- New `CallAnalyticsDashboard` component with:
  - Call volume chart (inbound vs outbound, daily/weekly)
  - Average call duration trends
  - Missed call rate and response time
  - Top callers/callees leaderboard
  - Call outcome distribution (answered, missed, voicemail, busy)
- `useCallAnalytics` hook -- aggregates from `communications` table where source=ringcentral
- New tab "Phone Analytics" in the Inbox settings or a dedicated route

### Track 5: SMS Templates & Bulk SMS
**RingCentral API**: `/restapi/v1.0/account/~/extension/~/sms` (already used)

Currently SMS is only sent via Vizzy one-at-a-time.

**Deliverables:**
- New `sms_templates` table (id, company_id, name, body, category, created_by, created_at)
- `SMSTemplateManager` component -- CRUD for SMS templates with variable placeholders ({name}, {company}, etc.)
- `BulkSMSDialog` component -- select contacts, pick template, preview, send batch
- Extend `ringcentral-action` to support `type: "bulk_sms"` with array of recipients
- Rate-limited sending (1 SMS/second to comply with RC limits)

### Track 6: Call Queue & Monitoring (Admin)
**RingCentral API**: `/restapi/v1.0/account/~/extension/~/active-calls` + `/call-monitoring`

**Deliverables:**
- New edge function `ringcentral-active-calls` -- fetches currently active calls across the account
- `ActiveCallsPanel` component -- real-time view of all ongoing calls with from/to, duration, and status
- Whisper/barge controls for admin users (super admin only)
- Integrate into the CEO dashboard as a "Live Calls" widget

### Track 7: Contact Matching & CRM Enrichment
Currently webhook call events log phone numbers but don't auto-match to CRM contacts.

**Deliverables:**
- Enhance `ringcentral-webhook` call handler to auto-match incoming/outgoing phone numbers against `contacts` table
- Auto-link communications to contact records (add `contact_id` FK on communications if not present)
- When a call comes from an unknown number, create an "Unknown Caller" notification with option to add as contact
- Show caller info popup on inbound calls (contact name, company, recent interactions)
- `CallerIDPopup` component -- appears when webhook detects inbound call, shows contact card

---

## Technical Details

### Database Migrations
1. `rc_presence` table -- user_id (FK), status, dnd_status, telephony_status, message, updated_at; RLS company-scoped
2. `sms_templates` table -- id, company_id, name, body, category, variables (text[]), created_by, created_at; RLS company-scoped
3. Add index on `communications(source, metadata)` for voicemail/fax filtering
4. Add `contact_id` column to `communications` if not present (nullable UUID FK to contacts)

### New Edge Functions (3)
- `ringcentral-presence` -- fetch/subscribe to presence for connected users
- `ringcentral-fax-send` -- send fax with PDF attachment via RC API
- `ringcentral-active-calls` -- fetch active calls for the account

### New Frontend Components (10)
- `src/components/inbox/VoicemailPlayer.tsx`
- `src/components/inbox/FaxViewer.tsx`
- `src/components/inbox/SendFaxDialog.tsx`
- `src/components/inbox/SMSTemplateManager.tsx`
- `src/components/inbox/BulkSMSDialog.tsx`
- `src/components/inbox/CallAnalyticsDashboard.tsx`
- `src/components/inbox/ActiveCallsPanel.tsx`
- `src/components/inbox/CallerIDPopup.tsx`
- `src/components/shared/RCPresenceIndicator.tsx`
- `src/hooks/useRCPresence.ts`
- `src/hooks/useCallAnalytics.ts`

### Modified Files (6-8)
- `supabase/functions/ringcentral-sync/index.ts` -- add voicemail + fax sync
- `supabase/functions/ringcentral-webhook/index.ts` -- add contact matching + voicemail handling
- `supabase/functions/ringcentral-action/index.ts` -- add bulk SMS support
- `src/components/inbox/UnifiedInboxList.tsx` -- add voicemail/fax filter tabs
- `src/components/inbox/InboxView.tsx` -- add analytics tab, fax send, SMS templates
- `src/components/inbox/CommunicationViewer.tsx` -- render voicemail player + fax viewer
- `src/components/ceo/BusinessHeartbeat.tsx` -- add RC presence integration
- `src/components/teamhub/` -- add presence indicators

### Implementation Order
1. Database migrations (rc_presence, sms_templates, communications contact_id)
2. Track 7: Contact matching (foundational -- enriches all other tracks)
3. Track 1: Presence (quick win, high visibility)
4. Track 2: Voicemail (extends existing sync)
5. Track 3: Fax (extends existing sync + new send capability)
6. Track 4: Call analytics (pure frontend aggregation)
7. Track 5: SMS templates + bulk (extends existing action function)
8. Track 6: Active calls monitoring (admin feature)

