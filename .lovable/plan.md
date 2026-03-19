

# Vizzy as Your Phone Manager — Auto-Answer Calls + Voicemail Intelligence

## What You're Getting

Vizzy will act as your phone manager on extension 101:
1. **Answer inbound calls** — Vizzy picks up, talks to the caller like a manager, takes notes, then summarizes the call and tells you what happened and how to act
2. **Auto-process all voicemails** — Every new voicemail gets auto-transcribed, summarized, and you get notified with suggested actions
3. **Morning briefing integration** — Voicemail summaries are included in Vizzy's morning session

## Important Limitation (Call Answering)

Vizzy can only answer calls when the app is open in your browser. This uses the WebPhone (WebRTC) — it auto-answers on ext 101 and pipes the audio through OpenAI Realtime for an AI conversation. When you close the browser, calls go to voicemail (which Vizzy still auto-processes).

## Changes

### 1. Auto-Answer on Extension 101 via WebPhone

Modify `useWebPhone.ts`:
- When an inbound call arrives on ext 101, auto-answer it
- Connect the call audio to an OpenAI Realtime session with a "Vizzy receptionist" prompt
- The AI converses with the caller: greets them, asks who's calling and what they need, answers basic questions using ERP context (order status, delivery info)
- When call ends, send the transcript to `summarize-call` edge function
- Save summary + suggested actions to `vizzy_memory` (category: `call_summary`) and create a notification for the CEO

New component: `VizzyCallHandler.tsx` — invisible component mounted in the app layout that:
- Initializes WebPhone on app load
- Listens for inbound calls on ext 101
- Auto-answers and manages the AI conversation session
- On call end: summarizes, saves, notifies

### 2. Auto-Transcribe Voicemails via Webhook

Modify `ringcentral-webhook/index.ts`:
- Add a `handleVoicemailEvent` handler for voicemail message-store events
- When a new voicemail arrives:
  1. Download the recording via RingCentral API
  2. Send to `ringcentral-ai` (transcribe action) for AI transcription
  3. Save transcript + summary to `vizzy_memory` (category: `voicemail_summary`)
  4. Create a notification for the CEO: "New voicemail from [caller] — [summary]"
  5. Update the `communications` record with the transcript in metadata

### 3. New Edge Function: `vizzy-call-receptionist`

Handles the AI personality for phone conversations:
- Accepts caller info (number, matched contact name)
- Fetches relevant ERP context (orders, deliveries for that contact)
- Returns the system prompt for OpenAI Realtime with:
  - Professional but warm greeting as Vizzy
  - Context about the caller's account if matched
  - Instructions to take detailed notes and identify action items
  - Ability to answer basic questions (order status, delivery ETA)

### 4. Include Voicemails in Morning Briefing

Modify `vizzyFullContext.ts`:
- Add a "VOICEMAIL INBOX" section that queries recent unprocessed voicemails from `vizzy_memory` (category: `voicemail_summary`)
- Vizzy reads them out during the morning briefing protocol

### 5. CEO Notification for Call Summaries

After each auto